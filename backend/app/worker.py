"""Notification worker — long-running process that drains the Redis queue
y dispara recordatorios de citas 24h antes.

Run with:  python -m app.worker

Cada item en la cola es un evento con esta forma:
    {
      "type": "appointment_created" | "appointment_cancelled" | ... ,
      "payload": {
        "recipient_role": "patient" | "doctor" | "admin",
        "to_email": "...", "to_phone": "...", "to_name": "...",
        "counterpart_name": "...",  # el otro lado de la cita
        ...campos del evento
      }
    }
"""
import json
import logging
import smtplib
import time
from datetime import datetime, timedelta
from email.message import EmailMessage
from typing import Any, Dict
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.logging_config import setup_logging
from app.core.metrics import notifications_processed
from app.core.redis_client import get_redis
from app.models.appointment import Appointment, AppointmentStatus
from app.models.doctor import Doctor
from app.services.notifications import QUEUE_KEY, enqueue
from app.services.sms import send_sms

logger = logging.getLogger(__name__)

APP_TZ = ZoneInfo("America/Santiago")


def _safe(payload: Dict[str, Any], key: str, default: str = "") -> str:
    val = payload.get(key)
    return val if val is not None else default


def _render_email(event_type: str, payload: Dict[str, Any]) -> tuple[str, str]:
    """Devuelve (asunto, cuerpo) según el evento y rol del destinatario."""
    role = payload.get("recipient_role", "patient")
    to_name_first = (_safe(payload, "to_name").split(" ") or [""])[0]
    counterpart = _safe(payload, "counterpart_name")
    date = _safe(payload, "appointment_date")
    time_ = _safe(payload, "start_time")[:5]
    modality = _safe(payload, "modality")
    is_online = modality == "online"

    # ── Eventos de cita ──
    if event_type == "appointment_created":
        if role == "doctor":
            subject = f"Nueva cita agendada — {date}"
            body = (
                f"Hola {to_name_first},\n\n"
                f"Tienes una nueva cita con {counterpart} el {date} a las {time_}.\n"
                f"{'Modalidad: videollamada.' if is_online else 'Modalidad: presencial.'}\n\n"
                "Puedes revisar el detalle en tu agenda.\n\n— Calmar Agendamiento"
            )
        else:
            subject = f"Cita agendada para el {date}"
            body = (
                f"Hola {to_name_first},\n\n"
                f"Tu cita con {counterpart} ha sido agendada para el {date} a las {time_}.\n"
                f"{'Recibirás el link de la videollamada 15 min antes.' if is_online else ''}\n"
                "Te enviaremos un recordatorio 24h antes.\n\n— Calmar Agendamiento"
            )
        return subject, body

    if event_type == "appointment_cancelled":
        reason = _safe(payload, "reason", "no especificado")
        if role == "doctor":
            subject = f"Cita cancelada — {date}"
            body = (
                f"Hola {to_name_first},\n\n"
                f"La cita con {counterpart} del {date} a las {time_} fue cancelada.\n"
                f"Motivo: {reason}.\n\n— Calmar Agendamiento"
            )
        else:
            subject = f"Cita cancelada — {date}"
            body = (
                f"Hola {to_name_first},\n\n"
                f"Tu cita con {counterpart} del {date} a las {time_} fue cancelada.\n"
                f"Motivo: {reason}.\n\n— Calmar Agendamiento"
            )
        return subject, body

    if event_type == "appointment_confirmed":
        if role == "doctor":
            subject = f"Confirmaste una cita — {date}"
            body = (
                f"Hola {to_name_first},\n\n"
                f"Confirmaste la cita con {counterpart} del {date} a las {time_}.\n\n— Calmar Agendamiento"
            )
        else:
            subject = f"Cita confirmada — {date}"
            body = (
                f"Hola {to_name_first},\n\n"
                f"{counterpart} confirmó tu cita del {date} a las {time_}. ¡Te esperamos!\n\n— Calmar Agendamiento"
            )
        return subject, body

    if event_type == "appointment_rescheduled":
        old_date = _safe(payload, "old_date")
        old_start = _safe(payload, "old_start", "")[:5]
        if role == "doctor":
            subject = f"Cita reagendada — {date}"
            body = (
                f"Hola {to_name_first},\n\n"
                f"La cita con {counterpart} se movió:\n"
                f"  De: {old_date} {old_start}\n"
                f"  A:  {date} {time_}\n\n— Calmar Agendamiento"
            )
        else:
            subject = f"Cita reagendada para el {date}"
            body = (
                f"Hola {to_name_first},\n\n"
                f"Tu cita con {counterpart} se movió al {date} a las {time_}.\n\n— Calmar Agendamiento"
            )
        return subject, body

    if event_type == "appointment_reminder":
        if role == "doctor":
            subject = f"Mañana: cita con {counterpart}"
            body = (
                f"Hola {to_name_first},\n\n"
                f"Recordatorio: mañana {date} a las {time_} tienes cita con {counterpart}.\n\n— Calmar Agendamiento"
            )
        else:
            subject = f"Recordatorio: tu cita es mañana ({date})"
            body = (
                f"Hola {to_name_first},\n\n"
                f"Te recordamos tu cita con {counterpart} mañana {date} a las {time_}.\n"
                f"{'Recibirás el link de la videollamada en la pantalla de la cita 15 min antes.' if is_online else ''}\n\n— Calmar Agendamiento"
            )
        return subject, body

    if event_type == "payment_approved":
        if role == "admin":
            amount = payload.get("amount", 0)
            subject = f"Nuevo pago recibido — ${amount:,}".replace(",", ".")
            body = (
                f"Hola {to_name_first},\n\n"
                f"Se recibió un pago de ${amount:,} pesos por la cita del {date} a las {time_}.\n"
                f"Paciente: {_safe(payload, 'patient_name')}\n"
                f"Profesional: {_safe(payload, 'doctor_name')}\n\n— Calmar Agendamiento"
            ).replace(",", ".")
        else:
            subject = f"Pago confirmado — {date}"
            body = (
                f"Hola {to_name_first},\n\n"
                f"Recibimos tu pago. Tu cita con {counterpart} del {date} a las {time_} está confirmada.\n\n— Calmar Agendamiento"
            )
        return subject, body

    if event_type == "waitlist_slot_available":
        subject = f"Se liberó un cupo con {counterpart}"
        body = (
            f"Hola {to_name_first},\n\n"
            f"Se liberó un cupo con {counterpart} el {date}. Reserva ahora antes de que otra persona lo tome.\n\n— Calmar Agendamiento"
        )
        return subject, body

    # ── Eventos administrativos ──
    if event_type == "user_registered":
        new_user = _safe(payload, "new_user_name")
        subject = f"Nuevo registro: {new_user}"
        body = (
            f"Hola {to_name_first},\n\n"
            f"Se registró un nuevo {_safe(payload, 'new_user_role', 'paciente')} en la plataforma:\n"
            f"  Nombre: {new_user}\n"
            f"  Email: {_safe(payload, 'new_user_email')}\n"
            f"  RUT: {_safe(payload, 'new_user_rut') or '—'}\n\n— Calmar Agendamiento"
        )
        return subject, body

    # Fallback
    return f"Notificación: {event_type}", json.dumps(payload, indent=2, default=str)


def _render_sms(event_type: str, payload: Dict[str, Any]) -> str:
    """SMS ultra corto."""
    role = payload.get("recipient_role", "patient")
    first = (_safe(payload, "to_name").split(" ") or [""])[0]
    counterpart = _safe(payload, "counterpart_name")
    date = _safe(payload, "appointment_date")
    time_ = _safe(payload, "start_time")[:5]

    if event_type == "appointment_created":
        if role == "doctor":
            return f"Nueva cita con {counterpart} el {date} a las {time_}."
        return f"Hola {first}, tu cita con {counterpart} fue agendada para el {date} a las {time_}."
    if event_type == "appointment_cancelled":
        return f"Cita con {counterpart} del {date} a las {time_} fue cancelada."
    if event_type == "appointment_confirmed":
        return f"{counterpart} confirmó la cita del {date} a las {time_}."
    if event_type == "appointment_rescheduled":
        return f"Cita con {counterpart} movida al {date} {time_}."
    if event_type == "appointment_reminder":
        return f"Recordatorio: cita con {counterpart} mañana {date} {time_}."
    if event_type == "payment_approved":
        if role == "admin":
            return f"Pago recibido: {_safe(payload, 'patient_name')} — cita {date}."
        return f"Hola {first}, recibimos tu pago. Cita del {date} a las {time_} confirmada."
    if event_type == "waitlist_slot_available":
        return f"Hola {first}, se liberó un cupo con {counterpart} el {date}. Reserva ahora."
    if event_type == "user_registered":
        return f"Nuevo registro en Calmar: {_safe(payload, 'new_user_name')}."
    return f"Notificación: {event_type}"


def _send_email(to: str, subject: str, body: str) -> bool:
    if not settings.SMTP_HOST:
        logger.info("notification.smtp_disabled", extra={"to": to, "subject": subject, "body_preview": body[:200]})
        return True
    if not to:
        return False
    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()
            if settings.SMTP_USER:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD or "")
            smtp.send_message(msg)
        logger.info("notification.sent", extra={"to": to, "subject": subject})
        return True
    except Exception:
        logger.exception("notification.send_failed", extra={"to": to})
        return False


def _handle(raw: str) -> None:
    try:
        event = json.loads(raw)
    except json.JSONDecodeError:
        logger.error("notification.malformed_payload", extra={"raw": raw[:500]})
        notifications_processed.labels(type="unknown", outcome="failed").inc()
        return

    event_type = event.get("type", "unknown")
    payload = event.get("payload", {})

    # Compat: si llega con formato viejo (patient_email/patient_phone/patient_name)
    # lo traducimos al nuevo on-the-fly.
    if "to_email" not in payload and "patient_email" in payload:
        payload.setdefault("recipient_role", "patient")
        payload.setdefault("to_email", payload.get("patient_email"))
        payload.setdefault("to_phone", payload.get("patient_phone"))
        payload.setdefault("to_name", payload.get("patient_name", ""))
        payload.setdefault("counterpart_name", payload.get("doctor_name", ""))

    email = payload.get("to_email")
    phone = payload.get("to_phone")

    any_sent = False
    if email:
        subject, body = _render_email(event_type, payload)
        if _send_email(email, subject, body):
            any_sent = True
    if phone:
        sms_body = _render_sms(event_type, payload)
        if send_sms(phone, sms_body):
            any_sent = True

    if email or phone:
        notifications_processed.labels(
            type=event_type, outcome="sent" if any_sent else "failed",
        ).inc()
    else:
        notifications_processed.labels(type=event_type, outcome="skipped").inc()


# ─── Reminders 24h antes ─────────────────────────────────────────────────────
def reminders_job():
    """Encola recordatorios para paciente y doctor cuando una cita ocurre ~24h en el futuro."""
    db = SessionLocal()
    try:
        from sqlalchemy.orm import joinedload, selectinload
        now_local = datetime.now(APP_TZ).replace(tzinfo=None)
        target_min = now_local + timedelta(hours=23, minutes=30)
        target_max = now_local + timedelta(hours=24, minutes=30)

        upcoming = (
            db.query(Appointment)
            .options(
                joinedload(Appointment.patient),
                joinedload(Appointment.doctor).joinedload(Doctor.user),
            )
            .filter(
                Appointment.status.in_([AppointmentStatus.scheduled, AppointmentStatus.confirmed]),
                Appointment.reminder_sent == False,  # noqa: E712
                Appointment.appointment_date >= now_local.date(),
                Appointment.appointment_date <= (now_local + timedelta(days=2)).date(),
            )
            .all()
        )

        sent = 0
        for a in upcoming:
            appt_dt = datetime.combine(a.appointment_date, a.start_time)
            if not (target_min <= appt_dt <= target_max):
                continue
            patient_name = f"{a.patient.first_name} {a.patient.last_name}" if a.patient else ""
            doctor_name = (
                f"Dr(a). {a.doctor.user.first_name} {a.doctor.user.last_name}"
                if a.doctor and a.doctor.user else ""
            )
            common = {
                "appointment_id": a.id,
                "appointment_date": str(a.appointment_date),
                "start_time": str(a.start_time),
                "modality": a.modality,
                "patient_name": patient_name,
                "doctor_name": doctor_name,
            }
            # Paciente
            if a.patient and a.patient.email:
                enqueue("appointment_reminder", {
                    **common,
                    "recipient_role": "patient",
                    "to_email": a.patient.email,
                    "to_phone": a.patient.phone,
                    "to_name": patient_name,
                    "counterpart_name": doctor_name,
                })
            # Doctor
            if a.doctor and a.doctor.user and a.doctor.user.email:
                enqueue("appointment_reminder", {
                    **common,
                    "recipient_role": "doctor",
                    "to_email": a.doctor.user.email,
                    "to_phone": a.doctor.user.phone,
                    "to_name": doctor_name,
                    "counterpart_name": patient_name,
                })
            a.reminder_sent = True
            sent += 1
        if sent:
            db.commit()
            logger.info("worker.reminders_dispatched", extra={"count": sent})
    except Exception:
        logger.exception("worker.reminders_failed")
    finally:
        db.close()


def run() -> None:
    setup_logging()
    logger.info("worker.starting")

    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(reminders_job, "interval", minutes=10, next_run_time=datetime.utcnow() + timedelta(seconds=30))
    scheduler.start()
    logger.info("worker.scheduler_started")

    r = get_redis()
    while True:
        try:
            item = r.brpop(QUEUE_KEY, timeout=5)
            if item is None:
                continue
            _, raw = item
            _handle(raw)
        except KeyboardInterrupt:
            logger.info("worker.stopping")
            break
        except Exception:
            logger.exception("worker.loop_error")
            time.sleep(1)


if __name__ == "__main__":
    run()
