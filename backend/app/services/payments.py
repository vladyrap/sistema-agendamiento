"""Cliente MercadoPago Checkout Pro.

Si MP_ACCESS_TOKEN no está configurado, el sistema opera sin pagos:
las citas con consultation_price > 0 igual se crean, pero no se exige pago
ni se redirige al checkout.
"""
import hashlib
import hmac
import logging
from typing import Optional, Tuple
from urllib.parse import urlparse

from app.core.config import settings

logger = logging.getLogger(__name__)


def is_enabled() -> bool:
    return bool(settings.MP_ACCESS_TOKEN)


def is_production_token() -> bool:
    """True si el access token es de producción (APP_USR-...) y no sandbox (TEST-...)."""
    tk = settings.MP_ACCESS_TOKEN or ""
    return tk.startswith("APP_USR-") or (tk and not tk.startswith("TEST-"))


def verify_webhook_signature(*, x_signature: str, x_request_id: str, data_id: str) -> bool:
    """Valida la firma HMAC-SHA256 que MercadoPago envía con cada webhook.

    Formato del header x-signature: 'ts=<timestamp>,v1=<hmac_sha256_hex>'
    Manifest firmado: 'id:<data.id>;request-id:<x-request-id>;ts:<timestamp>;'

    Si MP_WEBHOOK_SECRET no está configurado, devolvemos True para no bloquear
    el flujo durante el setup inicial — pero loggeamos un WARNING bien visible.
    """
    secret = settings.MP_WEBHOOK_SECRET
    if not secret:
        logger.warning("payments.webhook_signature_skipped_no_secret")
        return True

    if not x_signature or not x_request_id or not data_id:
        logger.warning("payments.webhook_signature_missing_headers",
                       extra={"has_sig": bool(x_signature), "has_req_id": bool(x_request_id), "has_data": bool(data_id)})
        return False

    # Parsear "ts=...,v1=..."
    parts = {}
    for chunk in x_signature.split(","):
        if "=" in chunk:
            k, v = chunk.strip().split("=", 1)
            parts[k.strip()] = v.strip()
    ts = parts.get("ts", "")
    received_hash = parts.get("v1", "")
    if not ts or not received_hash:
        return False

    manifest = f"id:{data_id};request-id:{x_request_id};ts:{ts};"
    expected = hmac.new(secret.encode("utf-8"), manifest.encode("utf-8"), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, received_hash)


def _get_sdk():
    if not is_enabled():
        return None
    try:
        import mercadopago
        return mercadopago.SDK(settings.MP_ACCESS_TOKEN)
    except Exception:
        logger.exception("payments.mp_sdk_init_failed")
        return None


def _is_sandbox() -> bool:
    """Identificamos sandbox por el prefijo del token (TEST-...)."""
    return (settings.MP_ACCESS_TOKEN or "").startswith("TEST-")


def create_preference(*, appointment_id: int, amount: int, title: str,
                      payer_email: Optional[str] = None) -> Optional[Tuple[str, str]]:
    """Crea una preferencia de pago en MercadoPago.

    Retorna (preference_id, checkout_url) si funciona, None si fallar.
    Nunca lanza — el caller decide cómo manejar el fallo.
    """
    sdk = _get_sdk()
    if sdk is None:
        return None

    base = settings.APP_PUBLIC_URL.rstrip("/")
    success_url = f"{base}/patient/appointments?payment=success&appointment={appointment_id}"
    failure_url = f"{base}/patient/appointments?payment=failure&appointment={appointment_id}"
    pending_url = f"{base}/patient/appointments?payment=pending&appointment={appointment_id}"

    notification_url: Optional[str] = None
    parsed = urlparse(base)
    # MercadoPago requiere que la notification_url sea pública (no localhost).
    if parsed.hostname and parsed.hostname not in ("localhost", "127.0.0.1"):
        notification_url = f"{base}/api/webhooks/mercadopago"

    pref_data = {
        "items": [{
            "title": title[:250],
            "quantity": 1,
            "unit_price": float(amount),
            "currency_id": settings.MP_CURRENCY,
        }],
        "external_reference": str(appointment_id),
        "back_urls": {
            "success": success_url,
            "failure": failure_url,
            "pending": pending_url,
        },
        "auto_return": "approved",
        "statement_descriptor": "Agendamiento clínico",
    }
    if payer_email:
        pref_data["payer"] = {"email": payer_email}
    if notification_url:
        pref_data["notification_url"] = notification_url

    try:
        result = sdk.preference().create(pref_data)
    except Exception:
        logger.exception("payments.preference_create_failed",
                         extra={"appointment_id": appointment_id})
        return None

    if result.get("status") not in (200, 201):
        logger.error("payments.preference_create_bad_response",
                     extra={"status": result.get("status"), "response": result.get("response")})
        return None

    pref = result["response"]
    pref_id = pref["id"]
    checkout_url = pref["sandbox_init_point"] if _is_sandbox() else pref["init_point"]
    logger.info("payments.preference_created",
                extra={"appointment_id": appointment_id, "preference_id": pref_id})
    return pref_id, checkout_url


def fetch_payment(payment_id: str) -> Optional[dict]:
    """Lee el detalle de un pago dado su ID. Útil desde el webhook."""
    sdk = _get_sdk()
    if sdk is None:
        return None
    try:
        result = sdk.payment().get(payment_id)
        if result.get("status") not in (200, 201):
            return None
        return result.get("response")
    except Exception:
        logger.exception("payments.payment_fetch_failed",
                         extra={"payment_id": payment_id})
        return None
