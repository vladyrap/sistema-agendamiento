"""Centro de notificaciones del usuario.

NO persiste en BD — agrega eventos relevantes ya existentes en otras tablas
(citas próximas, tareas pendientes, tests por responder, crédito acreditado, etc.)
y devuelve una lista priorizada para el dropdown de la campanita.
"""
from datetime import date as date_type, datetime, time, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.doctor import Doctor
from app.models.appointment import Appointment, AppointmentStatus
from app.models.homework import HomeworkAssignment, HomeworkStatus
from app.models.questionnaire import QuestionnaireAssignment
from app.models.mood_entry import MoodEntry
from app.models.gift_card import UserCredit, CreditTransaction
from app.models.tutor import TutorRelationship
from app.models.company import CompanyMembership
from app.api.deps import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notificaciones"])


class NotificationItem(BaseModel):
    id: str            # "type:identifier" — ej "appointment:42"
    type: str          # appointment_upcoming, homework_pending, questionnaire_pending, credit_available, etc.
    title: str
    body: str = ""
    icon: str          # nombre del icono lucide-react
    tone: str          # brand | wellness | amber | rose
    link: Optional[str] = None
    timestamp: Optional[datetime] = None
    priority: int = 0  # más alto = más arriba en la lista


class NotificationsResponse(BaseModel):
    items: List[NotificationItem]
    unread_count: int


@router.get("/me", response_model=NotificationsResponse)
def my_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items: List[NotificationItem] = []

    if current_user.role == UserRole.patient:
        items = _patient_notifications(db, current_user)
    elif current_user.role == UserRole.doctor:
        items = _doctor_notifications(db, current_user)
    elif current_user.role == UserRole.tutor:
        items = _tutor_notifications(db, current_user)
    elif current_user.role == UserRole.admin:
        items = _admin_notifications(db, current_user)

    # Ordenar por prioridad desc, luego timestamp desc
    items.sort(key=lambda x: (-x.priority, -(x.timestamp.timestamp() if x.timestamp else 0)))

    return NotificationsResponse(items=items[:20], unread_count=len(items))


# ─── PATIENT ─────────────────────────────────────────────────────────────

def _patient_notifications(db: Session, user: User) -> List[NotificationItem]:
    items: List[NotificationItem] = []
    today = date_type.today()
    now = datetime.utcnow()

    # Próxima cita
    next_appt = (
        db.query(Appointment)
        .options(joinedload(Appointment.doctor).joinedload(Doctor.user),
                 joinedload(Appointment.doctor).joinedload(Doctor.specialty))
        .filter(
            Appointment.patient_id == user.id,
            Appointment.appointment_date >= today,
            Appointment.status.in_([AppointmentStatus.scheduled, AppointmentStatus.confirmed]),
        )
        .order_by(Appointment.appointment_date.asc(), Appointment.start_time.asc())
        .first()
    )
    if next_appt:
        days_to = (next_appt.appointment_date - today).days
        doc = next_appt.doctor
        doc_name = f"Dr(a). {doc.user.first_name} {doc.user.last_name}" if doc and doc.user else "tu profesional"
        if days_to == 0:
            timing = f"hoy a las {next_appt.start_time.strftime('%H:%M')}"
            priority = 100
        elif days_to == 1:
            timing = f"mañana a las {next_appt.start_time.strftime('%H:%M')}"
            priority = 90
        else:
            timing = f"en {days_to} días"
            priority = 50
        items.append(NotificationItem(
            id=f"appointment:{next_appt.id}",
            type="appointment_upcoming",
            title="Próxima cita",
            body=f"Con {doc_name} {timing}",
            icon="Calendar",
            tone="brand",
            link="/patient/appointments",
            timestamp=datetime.combine(next_appt.appointment_date, next_appt.start_time),
            priority=priority,
        ))

    # Tareas pendientes
    pending_hw = (
        db.query(HomeworkAssignment)
        .filter(
            HomeworkAssignment.patient_id == user.id,
            HomeworkAssignment.status == HomeworkStatus.pending,
        )
        .order_by(HomeworkAssignment.created_at.desc())
        .limit(3)
        .all()
    )
    for hw in pending_hw:
        overdue = hw.due_date and hw.due_date < today
        items.append(NotificationItem(
            id=f"homework:{hw.id}",
            type="homework_pending",
            title="Tarea pendiente" + (" (vencida)" if overdue else ""),
            body=hw.title,
            icon="ClipboardList",
            tone="rose" if overdue else "amber",
            link="/patient/homework",
            timestamp=hw.created_at,
            priority=80 if overdue else 60,
        ))

    # Cuestionarios pendientes
    pending_q = (
        db.query(QuestionnaireAssignment)
        .filter(
            QuestionnaireAssignment.patient_id == user.id,
            QuestionnaireAssignment.status == "pending",
        )
        .order_by(QuestionnaireAssignment.created_at.desc())
        .limit(3)
        .all()
    )
    for q in pending_q:
        items.append(NotificationItem(
            id=f"questionnaire:{q.id}",
            type="questionnaire_pending",
            title=f"Cuestionario pendiente · {q.code.upper()}",
            body="Tu profesional te asignó un test psicológico para responder.",
            icon="Sparkles",
            tone="brand",
            link=f"/patient/questionnaires/{q.id}",
            timestamp=q.created_at,
            priority=70,
        ))

    # Si no registró mood en >= 2 días
    last_mood = (
        db.query(MoodEntry)
        .filter(MoodEntry.patient_id == user.id)
        .order_by(MoodEntry.date.desc())
        .first()
    )
    if not last_mood or (today - last_mood.date).days >= 2:
        items.append(NotificationItem(
            id="mood_reminder",
            type="mood_reminder",
            title="¿Cómo te sentís hoy?",
            body="Hace varios días que no anotás tu estado de ánimo.",
            icon="Heart",
            tone="wellness",
            link="/patient/mood",
            timestamp=now,
            priority=30,
        ))

    # Crédito disponible
    uc = db.query(UserCredit).filter(UserCredit.user_id == user.id).first()
    if uc and uc.balance_clp > 0:
        items.append(NotificationItem(
            id="credit_available",
            type="credit_available",
            title=f"Tenés ${uc.balance_clp:,} CLP de saldo".replace(",", "."),
            body="Se aplica automáticamente al reservar tu próxima cita.",
            icon="Wallet",
            tone="wellness",
            link="/patient",
            timestamp=now,
            priority=40,
        ))

    # Beneficio empresa
    membership = (
        db.query(CompanyMembership)
        .options(joinedload(CompanyMembership.company))
        .filter(CompanyMembership.patient_id == user.id, CompanyMembership.is_active == True)
        .first()
    )
    if membership and membership.company and membership.company.is_active and (membership.company.sessions_pool or 0) > 0:
        items.append(NotificationItem(
            id=f"company_benefit:{membership.company.id}",
            type="company_benefit",
            title=f"{membership.company.name} cubre tus consultas",
            body=f"Pool restante: {membership.company.sessions_pool} sesiones.",
            icon="Building2",
            tone="brand",
            link="/patient",
            timestamp=now,
            priority=20,
        ))

    return items


# ─── DOCTOR ──────────────────────────────────────────────────────────────

def _doctor_notifications(db: Session, user: User) -> List[NotificationItem]:
    items: List[NotificationItem] = []
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        return items

    today = date_type.today()
    now = datetime.utcnow()

    # Citas de hoy
    today_appts = (
        db.query(Appointment)
        .options(joinedload(Appointment.patient))
        .filter(
            Appointment.doctor_id == doctor.id,
            Appointment.appointment_date == today,
            Appointment.status.in_([AppointmentStatus.scheduled, AppointmentStatus.confirmed]),
        )
        .order_by(Appointment.start_time.asc())
        .all()
    )
    for a in today_appts:
        patient_name = f"{a.patient.first_name} {a.patient.last_name}" if a.patient else "Paciente"
        items.append(NotificationItem(
            id=f"appointment:{a.id}",
            type="appointment_today",
            title=f"Cita hoy {a.start_time.strftime('%H:%M')}",
            body=f"Con {patient_name}",
            icon="Calendar",
            tone="brand",
            link="/doctor/schedule",
            timestamp=datetime.combine(a.appointment_date, a.start_time),
            priority=100,
        ))

    # Pacientes con mood score bajo (≤ 3) en últimos 7 días
    patient_ids_q = (
        db.query(Appointment.patient_id)
        .filter(Appointment.doctor_id == doctor.id)
        .distinct()
        .subquery()
    )
    since = today - timedelta(days=7)
    low_moods = (
        db.query(MoodEntry, User)
        .join(User, User.id == MoodEntry.patient_id)
        .filter(
            MoodEntry.patient_id.in_(db.query(patient_ids_q.c.patient_id)),
            MoodEntry.score <= 3,
            MoodEntry.date >= since,
        )
        .order_by(MoodEntry.date.desc())
        .limit(5)
        .all()
    )
    for entry, patient in low_moods:
        items.append(NotificationItem(
            id=f"low_mood:{entry.id}",
            type="patient_low_mood",
            title=f"{patient.first_name} {patient.last_name} reportó ánimo bajo",
            body=f"Score {entry.score}/10 el {entry.date.strftime('%d %b')}",
            icon="AlertTriangle",
            tone="rose",
            link=f"/doctor/patients/{patient.id}",
            timestamp=datetime.combine(entry.date, time(12, 0)),
            priority=90,
        ))

    # Tareas completadas recientemente por pacientes
    recent_completed = (
        db.query(HomeworkAssignment)
        .options(joinedload(HomeworkAssignment.patient))
        .filter(
            HomeworkAssignment.doctor_id == doctor.id,
            HomeworkAssignment.status == HomeworkStatus.completed,
            HomeworkAssignment.completed_at >= now - timedelta(days=7),
        )
        .order_by(HomeworkAssignment.completed_at.desc())
        .limit(5)
        .all()
    )
    for hw in recent_completed:
        patient_name = f"{hw.patient.first_name} {hw.patient.last_name}" if hw.patient else "Paciente"
        items.append(NotificationItem(
            id=f"hw_completed:{hw.id}",
            type="homework_completed",
            title=f"{patient_name} completó una tarea",
            body=hw.title,
            icon="CheckCircle",
            tone="wellness",
            link=f"/doctor/patients/{hw.patient_id}",
            timestamp=hw.completed_at,
            priority=50,
        ))

    return items


# ─── TUTOR ───────────────────────────────────────────────────────────────

def _tutor_notifications(db: Session, user: User) -> List[NotificationItem]:
    items: List[NotificationItem] = []
    today = date_type.today()
    now = datetime.utcnow()

    rels = (
        db.query(TutorRelationship)
        .options(joinedload(TutorRelationship.patient))
        .filter(TutorRelationship.tutor_user_id == user.id)
        .all()
    )
    for r in rels:
        if not r.patient:
            continue
        # Score muy bajo del paciente en últimos 7 días
        recent_low = (
            db.query(MoodEntry)
            .filter(
                MoodEntry.patient_id == r.patient_id,
                MoodEntry.score <= 3,
                MoodEntry.date >= today - timedelta(days=7),
            )
            .order_by(MoodEntry.date.desc())
            .first()
        )
        if recent_low:
            items.append(NotificationItem(
                id=f"tutor_low_mood:{recent_low.id}",
                type="tutee_low_mood",
                title=f"{r.patient.first_name} reportó ánimo bajo",
                body=f"Score {recent_low.score}/10 el {recent_low.date.strftime('%d %b')}. Considerá contactarle.",
                icon="AlertTriangle",
                tone="rose",
                link=f"/tutor/patients/{r.patient_id}",
                timestamp=datetime.combine(recent_low.date, time(12, 0)),
                priority=100,
            ))
        # Próxima cita del paciente
        next_a = (
            db.query(Appointment)
            .filter(
                Appointment.patient_id == r.patient_id,
                Appointment.appointment_date >= today,
                Appointment.status.in_([AppointmentStatus.scheduled, AppointmentStatus.confirmed]),
            )
            .order_by(Appointment.appointment_date.asc(), Appointment.start_time.asc())
            .first()
        )
        if next_a:
            items.append(NotificationItem(
                id=f"tutor_next_appt:{next_a.id}",
                type="tutee_appointment",
                title=f"{r.patient.first_name} tiene cita",
                body=f"{next_a.appointment_date.strftime('%d %b')} a las {next_a.start_time.strftime('%H:%M')}",
                icon="Calendar",
                tone="brand",
                link=f"/tutor/patients/{r.patient_id}",
                timestamp=datetime.combine(next_a.appointment_date, next_a.start_time),
                priority=40,
            ))
    return items


# ─── ADMIN ───────────────────────────────────────────────────────────────

def _admin_notifications(db: Session, user: User) -> List[NotificationItem]:
    items: List[NotificationItem] = []
    today = date_type.today()
    now = datetime.utcnow()

    # Registros nuevos en últimas 24h
    recent_users = (
        db.query(User)
        .filter(User.created_at >= now - timedelta(days=1))
        .order_by(User.created_at.desc())
        .limit(5)
        .all()
    )
    for u in recent_users:
        items.append(NotificationItem(
            id=f"new_user:{u.id}",
            type="new_user",
            title=f"Nuevo {u.role.value if hasattr(u.role, 'value') else u.role}: {u.first_name} {u.last_name}",
            body=u.email,
            icon="UserPlus",
            tone="brand",
            link="/admin/users",
            timestamp=u.created_at,
            priority=60,
        ))

    # Citas canceladas en últimas 24h
    cancelled = (
        db.query(Appointment)
        .options(joinedload(Appointment.patient))
        .filter(
            Appointment.status == AppointmentStatus.cancelled,
            Appointment.updated_at >= now - timedelta(days=1),
        )
        .order_by(Appointment.updated_at.desc())
        .limit(5)
        .all()
    )
    for a in cancelled:
        items.append(NotificationItem(
            id=f"cancelled:{a.id}",
            type="appointment_cancelled",
            title="Cita cancelada",
            body=f"{a.patient.first_name + ' ' + a.patient.last_name if a.patient else '?'} · {a.appointment_date.strftime('%d %b')}",
            icon="X",
            tone="rose",
            link="/admin/appointments",
            timestamp=a.updated_at,
            priority=40,
        ))
    return items
