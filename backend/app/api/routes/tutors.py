"""Sistema de tutores / contactos de crisis.

Cada paciente puede tener uno o más tutores. Un tutor puede:
- Ser solo un contacto (nombre + email/phone), o
- Tener cuenta en el sistema (role=tutor) y loguearse para ver al paciente

Si se agrega un tutor por email y existe un User con ese email + role=tutor,
se vincula automáticamente.
"""
from datetime import date as date_type, timedelta, datetime, time
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.tutor import TutorRelationship
from app.models.appointment import Appointment, AppointmentStatus
from app.models.mood_entry import MoodEntry
from app.models.homework import HomeworkAssignment, HomeworkStatus
from app.schemas.tutor import (
    TutorCreate, TutorUpdate, TutorResponse, TutorPatientSummary, AlertTutorRequest,
    DoctorTutorItem,
)
from app.models.doctor import Doctor
from app.services.notifications import enqueue
from app.api.deps import get_current_user

router = APIRouter(prefix="/tutors", tags=["Tutores"])


def _can_manage(current_user: User, patient_id: int) -> bool:
    if current_user.role in (UserRole.admin, UserRole.doctor, UserRole.receptionist):
        return True
    if current_user.role == UserRole.patient and current_user.id == patient_id:
        return True
    return False


def _serialize(t: TutorRelationship) -> TutorResponse:
    return TutorResponse(
        id=t.id,
        patient_id=t.patient_id,
        tutor_user_id=t.tutor_user_id,
        has_account=t.tutor_user_id is not None,
        name=t.name,
        relationship_label=t.relationship_label,
        email=t.email,
        phone=t.phone,
        rut=t.rut,
        is_legal_guardian=bool(t.is_legal_guardian),
        notify_on_crisis=bool(t.notify_on_crisis),
        notify_on_appointments=bool(t.notify_on_appointments),
        can_view_full_profile=bool(t.can_view_full_profile),
        notes=t.notes or "",
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


def _auto_link_tutor_user(db: Session, t: TutorRelationship):
    """Si hay un User con role=tutor y email coincidente, vincularlo."""
    if t.tutor_user_id or not t.email:
        return
    user = (
        db.query(User)
        .filter(User.email == t.email.lower(), User.role == UserRole.tutor, User.is_active == True)
        .first()
    )
    if user:
        t.tutor_user_id = user.id


# ─── CRUD ─────────────────────────────────────────────────────────────────

@router.post("/patient/{patient_id}", response_model=TutorResponse, status_code=201)
def add_tutor(
    patient_id: int,
    data: TutorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _can_manage(current_user, patient_id):
        raise HTTPException(status_code=403, detail="Sin permiso")
    patient = db.query(User).filter(User.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    t = TutorRelationship(
        patient_id=patient_id,
        name=data.name.strip(),
        relationship_label=data.relationship_label.strip(),
        email=(data.email or "").lower() or None,
        phone=data.phone,
        rut=data.rut,
        is_legal_guardian=data.is_legal_guardian,
        notify_on_crisis=data.notify_on_crisis,
        notify_on_appointments=data.notify_on_appointments,
        can_view_full_profile=data.can_view_full_profile,
        notes=data.notes or "",
    )
    _auto_link_tutor_user(db, t)
    db.add(t)
    db.commit()
    db.refresh(t)

    # Notificación de bienvenida si se vinculó usuario tutor
    if t.tutor_user_id:
        enqueue("tutor_linked", {
            "recipient_role": "tutor",
            "to_email": t.email,
            "to_name": t.name,
            "patient_name": f"{patient.first_name} {patient.last_name}",
        })

    return _serialize(t)


@router.patch("/{tutor_id}", response_model=TutorResponse)
def update_tutor(
    tutor_id: int,
    data: TutorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(TutorRelationship).filter(TutorRelationship.id == tutor_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tutor no encontrado")
    if not _can_manage(current_user, t.patient_id):
        raise HTTPException(status_code=403, detail="Sin permiso")
    for k, v in data.model_dump(exclude_none=True).items():
        if k == "email" and v:
            v = v.lower()
        setattr(t, k, v)
    _auto_link_tutor_user(db, t)
    db.commit()
    db.refresh(t)
    return _serialize(t)


@router.delete("/{tutor_id}", status_code=204)
def delete_tutor(
    tutor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(TutorRelationship).filter(TutorRelationship.id == tutor_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tutor no encontrado")
    if not _can_manage(current_user, t.patient_id):
        raise HTTPException(status_code=403, detail="Sin permiso")
    db.delete(t)
    db.commit()


# ─── Listados ────────────────────────────────────────────────────────────

@router.get("/patient/{patient_id}", response_model=List[TutorResponse])
def list_patient_tutors(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Doctor/admin/recepcion + paciente dueño + tutor del paciente pueden ver
    is_authorized = (
        current_user.role in (UserRole.admin, UserRole.doctor, UserRole.receptionist)
        or (current_user.role == UserRole.patient and current_user.id == patient_id)
        or (current_user.role == UserRole.tutor and db.query(TutorRelationship).filter(
            TutorRelationship.patient_id == patient_id,
            TutorRelationship.tutor_user_id == current_user.id,
        ).first() is not None)
    )
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Sin permiso")
    rows = (
        db.query(TutorRelationship)
        .filter(TutorRelationship.patient_id == patient_id)
        .order_by(TutorRelationship.is_legal_guardian.desc(), TutorRelationship.created_at.asc())
        .all()
    )
    return [_serialize(t) for t in rows]


@router.get("/me/patients", response_model=List[TutorPatientSummary])
def my_patients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Para el rol tutor: lista de pacientes de los que es tutor + resumen rápido."""
    if current_user.role != UserRole.tutor:
        raise HTTPException(status_code=403, detail="Solo tutores")
    rels = (
        db.query(TutorRelationship)
        .options(joinedload(TutorRelationship.patient))
        .filter(TutorRelationship.tutor_user_id == current_user.id)
        .all()
    )
    today = date_type.today()
    items: List[TutorPatientSummary] = []
    for r in rels:
        p = r.patient
        # Última mood entry
        latest_mood = (
            db.query(MoodEntry)
            .filter(MoodEntry.patient_id == p.id)
            .order_by(MoodEntry.date.desc())
            .first()
        )
        # Próxima cita
        next_appt = (
            db.query(Appointment)
            .filter(
                Appointment.patient_id == p.id,
                Appointment.appointment_date >= today,
                Appointment.status.in_([AppointmentStatus.scheduled, AppointmentStatus.confirmed]),
            )
            .order_by(Appointment.appointment_date.asc(), Appointment.start_time.asc())
            .first()
        )
        # Tareas pendientes
        pending_hw = (
            db.query(HomeworkAssignment)
            .filter(
                HomeworkAssignment.patient_id == p.id,
                HomeworkAssignment.status == HomeworkStatus.pending,
            )
            .count()
        )

        items.append(TutorPatientSummary(
            patient_id=p.id,
            patient_name=f"{p.first_name} {p.last_name}",
            patient_email=p.email,
            is_legal_guardian=bool(r.is_legal_guardian),
            relationship_label=r.relationship_label,
            mood_score_latest=latest_mood.score if latest_mood else None,
            mood_date_latest=latest_mood.date.isoformat() if latest_mood else None,
            next_appointment_date=next_appt.appointment_date.isoformat() if next_appt else None,
            next_appointment_time=next_appt.start_time.strftime("%H:%M") if next_appt else None,
            pending_homework=pending_hw,
        ))
    return items


# ─── Acciones ────────────────────────────────────────────────────────────

@router.post("/{tutor_id}/alert", status_code=202)
def alert_tutor(
    tutor_id: int,
    data: AlertTutorRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Doctor/admin/recepcion manda manualmente una alerta al tutor."""
    if current_user.role not in (UserRole.doctor, UserRole.admin, UserRole.receptionist):
        raise HTTPException(status_code=403, detail="Sin permiso")
    t = db.query(TutorRelationship).filter(TutorRelationship.id == tutor_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tutor no encontrado")
    if not t.email and not t.phone:
        raise HTTPException(status_code=400, detail="El tutor no tiene email ni teléfono")
    patient = db.query(User).filter(User.id == t.patient_id).first()
    enqueue("tutor_manual_alert", {
        "recipient_role": "tutor",
        "to_email": t.email,
        "to_phone": t.phone,
        "to_name": t.name,
        "patient_name": f"{patient.first_name} {patient.last_name}",
        "sender_name": f"{current_user.first_name} {current_user.last_name}",
        "sender_role": current_user.role.value,
        "message": data.message or "Se solicita tu atención respecto al paciente bajo tu tutoría.",
    })
    return {"queued": True}


@router.get("/search-users")
def search_tutor_users(
    q: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Busca usuarios con rol=tutor para autocompletar al agregar tutor a un paciente.

    Solo staff (doctor/admin/recepcion) puede buscar — los pacientes deberían
    agregar al tutor por email directamente (privacidad).
    """
    if current_user.role not in (UserRole.doctor, UserRole.admin, UserRole.receptionist):
        raise HTTPException(status_code=403, detail="Sin permiso")
    from sqlalchemy import or_
    query = db.query(User).filter(User.role == UserRole.tutor, User.is_active == True)
    q = (q or "").strip()
    if q:
        like = f"%{q}%"
        query = query.filter(or_(
            User.first_name.ilike(like),
            User.last_name.ilike(like),
            User.email.ilike(like),
            User.rut.ilike(like),
            User.phone.ilike(like),
        ))
    rows = query.order_by(User.first_name.asc()).limit(20).all()
    return [
        {
            "id": u.id,
            "name": f"{u.first_name} {u.last_name}",
            "email": u.email,
            "phone": u.phone,
            "rut": u.rut,
        }
        for u in rows
    ]


@router.get("/doctor/me", response_model=List[DoctorTutorItem])
def doctor_tutors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Todos los tutores de los pacientes del doctor actual."""
    if current_user.role != UserRole.doctor:
        raise HTTPException(status_code=403, detail="Solo profesionales")
    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Perfil de profesional no encontrado")

    # IDs de pacientes con citas con este doctor
    patient_ids_q = (
        db.query(Appointment.patient_id)
        .filter(Appointment.doctor_id == doctor.id)
        .distinct()
        .all()
    )
    patient_ids = [p[0] for p in patient_ids_q]
    if not patient_ids:
        return []

    rows = (
        db.query(TutorRelationship)
        .options(joinedload(TutorRelationship.patient))
        .filter(TutorRelationship.patient_id.in_(patient_ids))
        .order_by(
            TutorRelationship.is_legal_guardian.desc(),
            TutorRelationship.created_at.desc(),
        )
        .all()
    )

    today = date_type.today()
    items: List[DoctorTutorItem] = []
    for r in rows:
        p = r.patient
        age = None
        if p and p.birth_date:
            age = today.year - p.birth_date.year
            if (today.month, today.day) < (p.birth_date.month, p.birth_date.day):
                age -= 1
        items.append(DoctorTutorItem(
            tutor_id=r.id,
            tutor_user_id=r.tutor_user_id,
            has_account=r.tutor_user_id is not None,
            name=r.name,
            relationship_label=r.relationship_label,
            email=r.email,
            phone=r.phone,
            rut=r.rut,
            is_legal_guardian=bool(r.is_legal_guardian),
            notify_on_crisis=bool(r.notify_on_crisis),
            notify_on_appointments=bool(r.notify_on_appointments),
            notes=r.notes or "",
            patient_id=p.id if p else 0,
            patient_name=f"{p.first_name} {p.last_name}" if p else "",
            patient_is_minor=age is not None and age < 18,
        ))
    return items


def notify_tutors_of_crisis(db: Session, patient: User, score: int, note: str = ""):
    """Helper para que otros módulos (mood) notifiquen a tutores cuando hay crisis."""
    tutors = (
        db.query(TutorRelationship)
        .filter(
            TutorRelationship.patient_id == patient.id,
            TutorRelationship.notify_on_crisis == True,
        )
        .all()
    )
    for t in tutors:
        if not (t.email or t.phone):
            continue
        enqueue("tutor_crisis_alert", {
            "recipient_role": "tutor",
            "to_email": t.email,
            "to_phone": t.phone,
            "to_name": t.name,
            "patient_name": f"{patient.first_name} {patient.last_name}",
            "patient_email": patient.email,
            "patient_phone": patient.phone,
            "score": score,
            "note": note,
        })
