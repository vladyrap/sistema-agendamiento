"""Endpoints de pacientes accesibles por staff (recepción + admin) + ficha completa."""
import secrets
import string
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.doctor import Doctor
from app.models.appointment import Appointment, AppointmentStatus
from app.models.session_log import SessionLog
from app.models.medical_record import MedicalRecord
from app.schemas.user import UserResponse, AdminPatientUpdate
from app.schemas.staff import StaffPatientCreate, StaffPatientCreateResponse
from app.api.deps import require_staff, require_admin, get_current_user

router = APIRouter(prefix="/patients", tags=["Pacientes"])


def _generate_password(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


@router.get("/search", response_model=List[UserResponse])
def search_patients(
    q: str = Query("", min_length=0, max_length=100),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    query = db.query(User).filter(User.role == UserRole.patient)
    q = (q or "").strip()
    if q:
        like = f"%{q}%"
        query = query.filter(or_(
            User.first_name.ilike(like),
            User.last_name.ilike(like),
            User.email.ilike(like),
            User.rut.ilike(like),
        ))
    return query.order_by(User.first_name).limit(limit).all()


@router.post("/", response_model=StaffPatientCreateResponse, status_code=201)
def create_patient(
    data: StaffPatientCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    if data.rut and db.query(User).filter(User.rut == data.rut).first():
        raise HTTPException(status_code=400, detail="El RUT ya está registrado")

    password = _generate_password()
    user = User(
        email=data.email,
        password_hash=get_password_hash(password),
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        rut=data.rut,
        role=UserRole.patient,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return StaffPatientCreateResponse(user=user, generated_password=password)


@router.put("/{patient_id}/clinical", response_model=UserResponse)
def update_patient_clinical(
    patient_id: int,
    data: AdminPatientUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Admin actualiza estado clínico y profesional asignado."""
    user = db.query(User).filter(User.id == patient_id, User.role == UserRole.patient).first()
    if not user:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    if data.patient_status is not None:
        user.patient_status = data.patient_status
    if data.assigned_doctor_id is not None:
        if data.assigned_doctor_id and not db.query(Doctor).filter(Doctor.id == data.assigned_doctor_id).first():
            raise HTTPException(status_code=404, detail="Médico no encontrado")
        user.assigned_doctor_id = data.assigned_doctor_id or None
    db.commit()
    db.refresh(user)
    return user


def _can_view_full_profile(current_user: User, patient_id: int, db: Session = None) -> bool:
    if current_user.id == patient_id:
        return True
    if current_user.role in (UserRole.doctor, UserRole.receptionist, UserRole.admin):
        return True
    # Tutor con acceso al perfil del paciente
    if current_user.role == UserRole.tutor and db is not None:
        from app.models.tutor import TutorRelationship
        link = db.query(TutorRelationship).filter(
            TutorRelationship.patient_id == patient_id,
            TutorRelationship.tutor_user_id == current_user.id,
            TutorRelationship.can_view_full_profile == True,
        ).first()
        return link is not None
    return False


@router.get("/{patient_id}/full")
def get_patient_full(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ficha completa del paciente: datos personales, ficha clínica, profesional asignado,
    timeline de citas con session logs, próxima cita, última atención."""
    if not _can_view_full_profile(current_user, patient_id, db):
        raise HTTPException(status_code=403, detail="Sin permisos")

    user = db.query(User).filter(User.id == patient_id, User.role == UserRole.patient).first()
    if not user:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    record = db.query(MedicalRecord).filter(MedicalRecord.patient_id == patient_id).first()

    # Doctor asignado (si existe)
    assigned_doctor: Optional[Doctor] = None
    if user.assigned_doctor_id:
        assigned_doctor = (
            db.query(Doctor)
            .options(joinedload(Doctor.user), joinedload(Doctor.specialty), joinedload(Doctor.clinic))
            .filter(Doctor.id == user.assigned_doctor_id)
            .first()
        )

    # Citas con session logs
    appts = (
        db.query(Appointment)
        .options(
            joinedload(Appointment.doctor).joinedload(Doctor.user),
            joinedload(Appointment.doctor).joinedload(Doctor.specialty),
        )
        .filter(Appointment.patient_id == patient_id)
        .order_by(Appointment.appointment_date.desc(), Appointment.start_time.desc())
        .all()
    )

    log_by_appt = {
        sl.appointment_id: sl
        for sl in db.query(SessionLog)
        .filter(SessionLog.appointment_id.in_([a.id for a in appts]))
        .all()
    } if appts else {}

    def _appt_dict(a: Appointment) -> Dict[str, Any]:
        sl = log_by_appt.get(a.id)
        return {
            "id": a.id,
            "appointment_date": str(a.appointment_date),
            "start_time": str(a.start_time),
            "end_time": str(a.end_time),
            "status": a.status.value if a.status else None,
            "modality": a.modality,
            "reason": a.reason,
            "doctor": {
                "id": a.doctor.id,
                "first_name": a.doctor.user.first_name,
                "last_name": a.doctor.user.last_name,
                "specialty": a.doctor.specialty.name,
            } if a.doctor and a.doctor.user else None,
            "session_log": {
                "id": sl.id,
                "is_draft": sl.is_draft,
                "diagnosis": sl.diagnosis,
                "evolution": sl.evolution,
                "observations": sl.observations,
                "indications": sl.indications,
                "treatment": sl.treatment,
                "medications": sl.medications,
                "next_steps": sl.next_steps,
                "emotional_state": sl.emotional_state,
                "topics_discussed": sl.topics_discussed,
                "therapeutic_goals": sl.therapeutic_goals,
                "progress_notes": sl.progress_notes,
                "homework": sl.homework,
                "risk_level": sl.risk_level,
                "updated_at": sl.updated_at.isoformat() if sl.updated_at else None,
            } if sl else None,
        }

    # Última atención = cita completada más reciente
    last_attended = next((a for a in appts if a.status == AppointmentStatus.completed), None)
    # Próxima cita = primera futura no cancelada
    from datetime import date as _date
    today = _date.today()
    upcoming = sorted(
        [a for a in appts if a.appointment_date >= today and a.status in (AppointmentStatus.scheduled, AppointmentStatus.confirmed)],
        key=lambda a: (a.appointment_date, a.start_time),
    )
    next_appt = upcoming[0] if upcoming else None

    return {
        "patient": {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone": user.phone,
            "rut": user.rut,
            "birth_date": str(user.birth_date) if user.birth_date else None,
            "address": user.address,
            "health_insurance": user.health_insurance,
            "patient_status": user.patient_status or "active",
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "assigned_doctor_id": user.assigned_doctor_id,
        },
        "medical_record": {
            "blood_type": record.blood_type if record else None,
            "allergies": record.allergies if record else None,
            "chronic_conditions": record.chronic_conditions if record else None,
            "medications": record.medications if record else None,
            "emergency_contact_name": record.emergency_contact_name if record else None,
            "emergency_contact_phone": record.emergency_contact_phone if record else None,
            "notes": record.notes if record else None,
        },
        "assigned_doctor": {
            "id": assigned_doctor.id,
            "first_name": assigned_doctor.user.first_name,
            "last_name": assigned_doctor.user.last_name,
            "email": assigned_doctor.user.email,
            "phone": assigned_doctor.user.phone,
            "specialty": assigned_doctor.specialty.name,
            "clinic": assigned_doctor.clinic.name if assigned_doctor.clinic else None,
        } if assigned_doctor and assigned_doctor.user else None,
        "appointments": [_appt_dict(a) for a in appts],
        "last_attended": _appt_dict(last_attended) if last_attended else None,
        "next_appointment": _appt_dict(next_appt) if next_appt else None,
        "totals": {
            "appointments_total": len(appts),
            "appointments_completed": sum(1 for a in appts if a.status == AppointmentStatus.completed),
            "appointments_cancelled": sum(1 for a in appts if a.status == AppointmentStatus.cancelled),
        },
    }
