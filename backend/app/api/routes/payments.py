"""Endpoints relacionados con pagos: webhook de MercadoPago + estado público."""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.payment import Payment, PaymentStatus
from app.models.appointment import Appointment, AppointmentStatus
from app.schemas.payment import PaymentResponse
from app.services import payments as payments_service
from app.services.notifications import enqueue

router = APIRouter(tags=["Pagos"])
logger = logging.getLogger(__name__)


# Mapping del estado que devuelve MercadoPago a nuestro PaymentStatus.
MP_STATUS_MAP = {
    "approved":    PaymentStatus.approved,
    "authorized":  PaymentStatus.approved,
    "rejected":    PaymentStatus.rejected,
    "cancelled":   PaymentStatus.cancelled,
    "refunded":    PaymentStatus.refunded,
    "charged_back":PaymentStatus.refunded,
    "in_process":  PaymentStatus.pending,
    "in_mediation":PaymentStatus.pending,
    "pending":     PaymentStatus.pending,
}


@router.post("/webhooks/mercadopago", status_code=200, include_in_schema=False)
async def mercadopago_webhook(request: Request, db: Session = Depends(get_db)):
    """Recibe notificaciones de MercadoPago y actualiza el estado del Payment + Appointment.

    Devolvemos 200 siempre que sea un evento entendido — MercadoPago reintenta si no.
    """
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    # MP envía type+data.id. Nos interesan eventos de tipo "payment".
    event_type = payload.get("type") or payload.get("topic")
    data_id = (payload.get("data") or {}).get("id") or payload.get("id")

    if event_type != "payment" or not data_id:
        logger.info("payments.webhook_skipped",
                    extra={"event_type": event_type, "id": data_id})
        return {"ok": True, "skipped": True}

    # Validar firma HMAC del header x-signature (anti-spoof)
    x_signature = request.headers.get("x-signature", "")
    x_request_id = request.headers.get("x-request-id", "")
    if not payments_service.verify_webhook_signature(
        x_signature=x_signature, x_request_id=x_request_id, data_id=str(data_id),
    ):
        logger.warning("payments.webhook_invalid_signature",
                       extra={"data_id": data_id, "request_id": x_request_id})
        raise HTTPException(status_code=401, detail="Invalid signature")

    detail = payments_service.fetch_payment(str(data_id))
    if not detail:
        logger.warning("payments.webhook_payment_not_found", extra={"id": data_id})
        return {"ok": True, "skipped": True}

    external_ref = detail.get("external_reference") or ""
    mp_status = detail.get("status")
    new_status = MP_STATUS_MAP.get(mp_status, PaymentStatus.pending)

    if not external_ref:
        return {"ok": True, "skipped": True}

    # Si es una gift card (external_reference = "gift:<id>"), activarla
    if external_ref.startswith("gift:"):
        if mp_status == "approved":
            try:
                from app.api.routes.gifts import activate_gift_card_by_external_reference
                activate_gift_card_by_external_reference(
                    db, external_ref, mp_payment_id=str(detail.get("id")),
                )
                logger.info("gift.activated_via_webhook", extra={"ref": external_ref})
            except Exception:
                logger.exception("gift.activation_failed")
        return {"ok": True, "type": "gift", "status": mp_status}

    # Si no es gift card → flujo de cita normal
    try:
        appointment_id = int(external_ref)
    except (TypeError, ValueError):
        return {"ok": True, "skipped": True}

    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        return {"ok": True, "skipped": True}

    payment = (
        db.query(Payment)
        .filter(Payment.appointment_id == appointment.id)
        .order_by(Payment.id.desc())
        .first()
    )
    if not payment:
        # No teníamos registro — lo creamos con el monto del médico.
        payment = Payment(
            appointment_id=appointment.id,
            amount=int(detail.get("transaction_amount") or 0),
            currency=detail.get("currency_id") or "CLP",
            provider="mercadopago",
        )
        db.add(payment)

    payment.status = new_status
    payment.provider_payment_id = str(detail.get("id"))
    db.commit()

    # Si rechazado o cancelado, cancelamos la cita
    if new_status in (PaymentStatus.rejected, PaymentStatus.cancelled):
        if appointment.status == AppointmentStatus.scheduled:
            appointment.status = AppointmentStatus.cancelled
            appointment.cancellation_reason = "Pago rechazado"
            db.commit()

    # Notificación al paciente + a todos los admins cuando se aprueba un pago
    if new_status == PaymentStatus.approved:
        try:
            from app.api.routes.appointments import _load_appointment, _notification_payload
            from app.models.user import User as UserModel, UserRole
            loaded = _load_appointment(db, appointment.id)
            # Paciente
            enqueue("payment_approved", _notification_payload(loaded, recipient="patient"))
            # Admins
            admins = db.query(UserModel).filter(UserModel.role == UserRole.admin, UserModel.is_active == True).all()
            for admin in admins:
                payload = _notification_payload(loaded, recipient="patient")
                payload["recipient_role"] = "admin"
                payload["to_email"] = admin.email
                payload["to_phone"] = admin.phone
                payload["to_name"] = f"{admin.first_name} {admin.last_name}"
                payload["amount"] = payment.amount
                enqueue("payment_approved", payload)
        except Exception:
            logger.exception("payments.notify_failed")

        # Crear boleta de honorarios pendiente para el psicólogo/a.
        # Solo si el monto cobrado es > 0 (las cubiertas por empresa o gift card no generan boleta).
        try:
            from app.models.boleta import BoletaHonorarios, BoletaStatus
            already = (
                db.query(BoletaHonorarios)
                .filter(BoletaHonorarios.appointment_id == appointment.id)
                .first()
            )
            if not already and payment.amount and payment.amount > 0:
                b = BoletaHonorarios(
                    doctor_id=appointment.doctor_id,
                    patient_id=appointment.patient_id,
                    appointment_id=appointment.id,
                    amount_clp=payment.amount,
                    glosa="Atención psicológica",
                    service_date=appointment.appointment_date,
                    status=BoletaStatus.pending,
                )
                db.add(b)
                db.commit()
        except Exception:
            logger.exception("payments.boleta_create_failed")

    logger.info("payments.webhook_processed",
                extra={"appointment_id": appointment.id, "status": new_status.value})
    return {"ok": True, "status": new_status.value}


@router.get("/payments/{payment_id}", response_model=PaymentResponse)
def get_payment(payment_id: int, db: Session = Depends(get_db)):
    p = db.query(Payment).filter(Payment.id == payment_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    return p


@router.get("/admin/payments/health", include_in_schema=False)
def payments_health(db: Session = Depends(get_db)):
    """Diagnóstico rápido de la integración MercadoPago para el admin.

    No requiere auth de propósito (el admin lo lee desde el panel y no expone secrets).
    """
    from app.core.config import settings as app_settings
    tk = app_settings.MP_ACCESS_TOKEN or ""
    has_token = bool(tk)
    is_prod = payments_service.is_production_token()
    has_secret = bool(app_settings.MP_WEBHOOK_SECRET)
    public_url = app_settings.APP_PUBLIC_URL

    # Stats de pagos recientes
    last24h = db.query(Payment).order_by(Payment.id.desc()).limit(20).all()
    by_status = {}
    for p in last24h:
        key = p.status.value if p.status else "unknown"
        by_status[key] = by_status.get(key, 0) + 1

    issues = []
    if not has_token:
        issues.append("MP_ACCESS_TOKEN no configurado: el sistema NO procesará pagos.")
    if has_token and not is_prod:
        issues.append("Estás usando un token de SANDBOX (TEST-...). Para cobrar de verdad necesitas un token APP_USR-.")
    if not has_secret:
        issues.append("MP_WEBHOOK_SECRET vacío: el webhook acepta requests sin validar firma. Configurá el secret en cuanto puedas.")
    if public_url.startswith("http://localhost") or "localhost" in public_url:
        issues.append("APP_PUBLIC_URL apunta a localhost: MercadoPago no podrá llamar el webhook desde Internet.")

    return {
        "enabled": has_token,
        "mode": "production" if is_prod else ("sandbox" if has_token else "disabled"),
        "token_prefix": tk[:8] + "…" if tk else None,
        "webhook_signature_validation": has_secret,
        "app_public_url": public_url,
        "webhook_url": f"{public_url.rstrip('/')}/api/webhooks/mercadopago",
        "recent_payments_status": by_status,
        "issues": issues,
    }
