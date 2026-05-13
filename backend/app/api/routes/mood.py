"""Diario emocional del paciente."""
from datetime import date as date_type, timedelta, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, and_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.doctor import Doctor
from app.models.appointment import Appointment, AppointmentStatus
from app.models.mood_entry import MoodEntry
from app.schemas.mood import MoodCheckIn, MoodEntryResponse, MoodSummary, DoctorMoodFeedItem
from app.api.deps import get_current_user

router = APIRouter(prefix="/mood", tags=["Diario emocional"])


def _ensure_patient_access(current_user: User, target_patient_id: int):
    """Patient solo ve los suyos; doctor y admin pueden ver de cualquier paciente."""
    if current_user.role == UserRole.patient and current_user.id != target_patient_id:
        raise HTTPException(status_code=403, detail="Sin permiso para ver este diario")
    if current_user.role not in (UserRole.patient, UserRole.doctor, UserRole.admin, UserRole.receptionist):
        raise HTTPException(status_code=403, detail="Rol sin permiso")


def _compute_summary(db: Session, patient_id: int) -> MoodSummary:
    today = date_type.today()
    rows = (
        db.query(MoodEntry)
        .filter(MoodEntry.patient_id == patient_id)
        .order_by(MoodEntry.date.desc())
        .all()
    )
    if not rows:
        return MoodSummary(days_logged=0, current_streak=0)

    # Streak: días consecutivos contando hacia atrás desde hoy o ayer.
    dates = {r.date for r in rows}
    streak = 0
    cursor = today if today in dates else today - timedelta(days=1)
    while cursor in dates:
        streak += 1
        cursor -= timedelta(days=1)

    last30 = [r for r in rows if r.date >= today - timedelta(days=30)]
    last7 = [r for r in rows if r.date >= today - timedelta(days=7)]
    avg30 = (sum(r.score for r in last30) / len(last30)) if last30 else None
    avg7 = (sum(r.score for r in last7) / len(last7)) if last7 else None

    return MoodSummary(
        days_logged=len(rows),
        current_streak=streak,
        average_30d=round(avg30, 2) if avg30 is not None else None,
        average_7d=round(avg7, 2) if avg7 is not None else None,
        latest=rows[0],
    )


@router.post("/", response_model=MoodEntryResponse, status_code=200)
def check_in(
    data: MoodCheckIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upsert del estado de ánimo del día. Si ya existe entrada para esa fecha, la actualiza."""
    if current_user.role != UserRole.patient:
        raise HTTPException(status_code=403, detail="Solo pacientes pueden registrar su diario")
    entry_date = data.date or date_type.today()

    existing = (
        db.query(MoodEntry)
        .filter(MoodEntry.patient_id == current_user.id, MoodEntry.date == entry_date)
        .first()
    )
    if existing:
        existing.score = data.score
        existing.note = data.note or ""
        db.commit()
        db.refresh(existing)
        return existing

    entry = MoodEntry(
        patient_id=current_user.id,
        date=entry_date,
        score=data.score,
        note=data.note or "",
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=204)
def delete_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.query(MoodEntry).filter(MoodEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entrada no encontrada")
    if current_user.role != UserRole.admin and entry.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin permiso para borrar")
    db.delete(entry)
    db.commit()


@router.get("/me", response_model=List[MoodEntryResponse])
def my_entries(
    days: int = Query(default=90, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.patient:
        raise HTTPException(status_code=403, detail="Solo pacientes tienen diario propio")
    since = date_type.today() - timedelta(days=days)
    return (
        db.query(MoodEntry)
        .filter(MoodEntry.patient_id == current_user.id, MoodEntry.date >= since)
        .order_by(MoodEntry.date.asc())
        .all()
    )


@router.get("/me/summary", response_model=MoodSummary)
def my_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.patient:
        raise HTTPException(status_code=403, detail="Solo pacientes")
    return _compute_summary(db, current_user.id)


@router.get("/me/today", response_model=Optional[MoodEntryResponse])
def my_today(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Devuelve la entrada de hoy si existe, sino None. Útil para el widget del dashboard."""
    if current_user.role != UserRole.patient:
        raise HTTPException(status_code=403, detail="Solo pacientes")
    return (
        db.query(MoodEntry)
        .filter(MoodEntry.patient_id == current_user.id, MoodEntry.date == date_type.today())
        .first()
    )


@router.get("/patient/{patient_id}", response_model=List[MoodEntryResponse])
def patient_entries(
    patient_id: int,
    days: int = Query(default=90, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Doctor/admin/recepcion consultan el diario de un paciente."""
    _ensure_patient_access(current_user, patient_id)
    since = date_type.today() - timedelta(days=days)
    return (
        db.query(MoodEntry)
        .filter(MoodEntry.patient_id == patient_id, MoodEntry.date >= since)
        .order_by(MoodEntry.date.asc())
        .all()
    )


@router.get("/patient/{patient_id}/summary", response_model=MoodSummary)
def patient_summary(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_patient_access(current_user, patient_id)
    return _compute_summary(db, patient_id)


@router.get("/doctor/feed", response_model=List[DoctorMoodFeedItem])
def doctor_feed(
    days: int = Query(default=7, ge=1, le=30),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Feed de 'amanecidas' — última entrada de mood de cada paciente del doctor.

    Ordena por score ascendente (más bajo primero) para destacar quién necesita atención.
    Solo incluye pacientes con quien el doctor ha tenido (o tiene) citas.
    """
    if current_user.role != UserRole.doctor:
        raise HTTPException(status_code=403, detail="Solo médicos")
    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Perfil de médico no encontrado")

    since = date_type.today() - timedelta(days=days)

    # IDs de pacientes con citas con este doctor
    patient_ids_subq = (
        db.query(Appointment.patient_id)
        .filter(Appointment.doctor_id == doctor.id)
        .distinct()
        .subquery()
    )

    # Última entrada por paciente dentro del rango
    latest_by_patient = (
        db.query(
            MoodEntry.patient_id.label("patient_id"),
            func.max(MoodEntry.date).label("max_date"),
        )
        .filter(
            MoodEntry.patient_id.in_(db.query(patient_ids_subq.c.patient_id)),
            MoodEntry.date >= since,
        )
        .group_by(MoodEntry.patient_id)
        .subquery()
    )

    rows = (
        db.query(MoodEntry, User)
        .join(
            latest_by_patient,
            and_(
                MoodEntry.patient_id == latest_by_patient.c.patient_id,
                MoodEntry.date == latest_by_patient.c.max_date,
            ),
        )
        .join(User, User.id == MoodEntry.patient_id)
        .order_by(MoodEntry.score.asc(), MoodEntry.date.desc())
        .all()
    )

    today = date_type.today()
    items: List[DoctorMoodFeedItem] = []
    for entry, patient in rows:
        # Próxima cita con este doctor (si existe)
        next_appt = (
            db.query(Appointment)
            .filter(
                Appointment.doctor_id == doctor.id,
                Appointment.patient_id == patient.id,
                Appointment.appointment_date >= today,
                Appointment.status.in_([AppointmentStatus.scheduled, AppointmentStatus.confirmed]),
            )
            .order_by(Appointment.appointment_date.asc())
            .first()
        )
        items.append(
            DoctorMoodFeedItem(
                patient_id=patient.id,
                patient_name=f"{patient.first_name} {patient.last_name}",
                patient_email=patient.email,
                entry_id=entry.id,
                date=entry.date,
                score=entry.score,
                note=entry.note or "",
                next_appointment_date=next_appt.appointment_date if next_appt else None,
            )
        )

    return items
