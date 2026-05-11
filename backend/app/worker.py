"""Notification worker — long-running process that drains the Redis queue
y dispara recordatorios de citas 24h antes.

Run with:  python -m app.worker
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

# Por defecto las citas están en hora de Chile (los datos del seed lo asumen).
APP_TZ = ZoneInfo(settings.__dict__.get("APP_TIMEZONE", "America/Santiago") if False else "America/Santiago")


def _render_email(event_type: str, payload: Dict[str, Any]) -> tuple[str, str]:
    doctor = payload.get("doctor_name", "el especialista")
    date = payload.get("appointment_date", "")
    time_ = payload.get("start_time", "")
    name = payload.get("patient_name", "")

    if event_type == "appointment_created":
        subject = f"Cita agendada para el {date}"
        body = (
            f"Hola {name},\n\n"
            f"Tu cita con {doctor} ha sido agendada para el {date} a las {time_}.\n"
            "Te enviaremos un recordatorio 24 horas antes.\n\n— Sistema de Agendamiento Clínico"
        )
    elif event_type == "appointment_cancelled":
        subject = f"Cita cancelada — {date}"
        body = (
            f"Hola {name},\n\nTu cita con {doctor} del {date} a las {time_} ha sido cancelada.\n"
            f"Motivo: {payload.get('reason', 'no especificado')}.\n\n— Sistema de Agendamiento Clínico"
        )
    elif event_type == "appointment_confirmed":
        subject = f"Cita confirmada — {date}"
        body = f"Hola {name},\n\n{doctor} confirmó tu cita del {date} a las {time_}.\n\n— Sistema de Agendamiento Clínico"
    elif event_type == "appointment_reminder":
        subject = f"Recordatorio: tu cita es mañana ({date})"
        body = (
            f"Hola {name},\n\nTe recordamos tu cita con {doctor} mañana {date} a las {time_}.\n"
            f"{'Recibirás el link de la videollamada en la pantalla de la cita 15 min antes.' if payload.get('modality') == 'online' else ''}\n\n"
            "— Sistema de Agendamiento Clínico"
        )
    elif event_type == "appointment_rescheduled":
        subject = f"Cita reagendada para el {date}"
        body = (
            f"Hola {name},\n\nTu cita con {doctor} se movió al {date} a las {time_}.\n\n— Sistema de Agendamiento Clínico"
        )
    elif event_type == "payment_approved":
        subject = f"Pago confirmado — {date}"
        body = f"Hola {name},\n\nRecibimos tu pago. Cita con {doctor} el {date} a las {time_} confirmada.\n\n— Sistema de Agendamiento Clínico"
    elif event_type == "waitlist_slot_available":
        subject = f"Se liberó un cupo con {doctor}"
        body = (
            f"Hola {name},\n\nSe liberó un cupo con {doctor} el {date}. "
            "Reserva ahora antes de que otra persona lo tome.\n\n— Sistema de Agendamiento Clínico"
        )
    else:
        subject = f"Notificación: {event_type}"
        body = json.dumps(payload, indent=2, default=str)

    return subject, body


def _render_sms(event_type: str, payload: Dict[str, Any]) -> str:
    doctor = payload.get("doctor_name", "el especialista")
    date = payload.get("appointment_date", "")
    time_ = payload.get("start_time", "")
    name = (payload.get("patient_name") or "").split(" ")[0]

    if event_type == "appointment_created":
        return f"Hola {name}, tu cita con {doctor} fue agendada para el {date} a las {time_}."
    if event_type == "appointment_cancelled":
        return f"Hola {name}, tu cita con {doctor} del {date} a las {time_} fue cancelada."
    if event_type == "appointment_confirmed":
        return f"Hola {name}, {doctor} confirmó tu cita del {date} a las {time_}."
    if event_type == "appointment_reminder":
        return f"Recordatorio: tu cita con {doctor} es mañana {date} a las {time_}."
    if event_type == "appointment_rescheduled":
        return f"Hola {name}, tu cita con {doctor} fue movida al {date} a las {time_}."
    if event_type == "payment_approved":
        return f"Hola {name}, recibimos tu pago. Cita del {date} a las {time_} confirmada."
    if event_type == "waitlist_slot_available":
        return f"Hola {name}, se liberó un cupo con {doctor} el {date}. Reserva ahora."
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
    email = payload.get("patient_email")
    phone = payload.get("patient_phone")

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
    """Encola recordatorios para citas que ocurren ~24h en el futuro y no han sido reminded."""
    db = SessionLocal()
    try:
        now_local = datetime.now(APP_TZ).replace(tzinfo=None)
        target_min = now_local + timedelta(hours=23, minutes=30)
        target_max = now_local + timedelta(hours=24, minutes=30)

        # Traemos candidatos del día/dos días siguientes y filtramos en Python.
        upcoming = db.query(Appointment).filter(
            Appointment.status.in_([AppointmentStatus.scheduled, AppointmentStatus.confirmed]),
            Appointment.reminder_sent == False,  # noqa: E712
            Appointment.appointment_date >= now_local.date(),
            Appointment.appointment_date <= (now_local + timedelta(days=2)).date(),
        ).all()

        sent = 0
        for a in upcoming:
            appt_dt = datetime.combine(a.appointment_date, a.start_time)
            if not (target_min <= appt_dt <= target_max):
                continue
            payload = {
                "appointment_id": a.id,
                "patient_email": a.patient.email if a.patient else None,
                "patient_phone": a.patient.phone if a.patient else None,
                "patient_name": f"{a.patient.first_name} {a.patient.last_name}" if a.patient else "",
                "doctor_name": (
                    f"Dr(a). {a.doctor.user.first_name} {a.doctor.user.last_name}"
                    if a.doctor and a.doctor.user else ""
                ),
                "appointment_date": str(a.appointment_date),
                "start_time": str(a.start_time),
                "modality": a.modality,
            }
            enqueue("appointment_reminder", payload)
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
