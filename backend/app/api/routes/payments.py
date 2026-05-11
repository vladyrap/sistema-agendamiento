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

    detail = payments_service.fetch_payment(str(data_id))
    if not detail:
        logger.warning("payments.webhook_payment_not_found", extra={"id": data_id})
        return {"ok": True, "skipped": True}

    external_ref = detail.get("external_reference")  # = appointment_id
    mp_status = detail.get("status")
    new_status = MP_STATUS_MAP.get(mp_status, PaymentStatus.pending)

    if not external_ref:
        return {"ok": True, "skipped": True}

    appointment = db.query(Appointment).filter(Appointment.id == int(external_ref)).first()
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

    # Notificación al paciente cuando aprueba
    if new_status == PaymentStatus.approved:
        try:
            from app.api.routes.appointments import _load_appointment, _notification_payload
            loaded = _load_appointment(db, appointment.id)
            enqueue("payment_approved", _notification_payload(loaded))
        except Exception:
            logger.exception("payments.notify_failed")

    logger.info("payments.webhook_processed",
                extra={"appointment_id": appointment.id, "status": new_status.value})
    return {"ok": True, "status": new_status.value}


@router.get("/payments/{payment_id}", response_model=PaymentResponse)
def get_payment(payment_id: int, db: Session = Depends(get_db)):
    p = db.query(Payment).filter(Payment.id == payment_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    return p
