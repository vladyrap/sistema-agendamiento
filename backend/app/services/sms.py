"""Cliente Twilio para SMS.

Si TWILIO_ACCOUNT_SID está vacío, el sistema sigue funcionando — los SMS
quedan en logs (igual que el SMTP no configurado).
"""
import logging
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


def is_enabled() -> bool:
    return bool(settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_FROM_NUMBER)


def _normalize(phone: str) -> Optional[str]:
    """Normaliza a formato E.164. Para Chile: +56 9 xxxx xxxx → +569xxxxxxxx."""
    if not phone:
        return None
    cleaned = "".join(ch for ch in phone if ch.isdigit() or ch == "+")
    if not cleaned:
        return None
    if cleaned.startswith("+"):
        return cleaned
    if cleaned.startswith("00"):
        return "+" + cleaned[2:]
    # Si empieza con 9 (Chile móvil) → asumimos +56
    if len(cleaned) == 9 and cleaned[0] == "9":
        return "+56" + cleaned
    if len(cleaned) == 8:
        return "+569" + cleaned
    # Asumir Chile si nada calza
    return "+" + cleaned


def send_sms(to: str, body: str) -> bool:
    """Envía un SMS. Devuelve True si se mandó (o si está en log-mode).

    Nunca lanza excepciones — los fallos se loguean.
    """
    normalized = _normalize(to)
    if not normalized:
        logger.warning("sms.skipped_invalid_phone", extra={"to": to})
        return False

    body = body[:480]  # 3 segmentos máximo

    if not is_enabled():
        logger.info("sms.twilio_disabled",
                    extra={"to": normalized, "body": body})
        return True  # se considera "enviado" en dev

    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        message = client.messages.create(
            from_=settings.TWILIO_FROM_NUMBER,
            to=normalized,
            body=body,
        )
        logger.info("sms.sent", extra={"to": normalized, "sid": message.sid})
        return True
    except Exception:
        logger.exception("sms.send_failed", extra={"to": normalized})
        return False
