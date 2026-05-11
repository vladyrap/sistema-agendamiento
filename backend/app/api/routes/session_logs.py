"""Nota clínica estructurada por cita. Solo el médico de la cita la edita."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.metrics import appointments_completed
from app.models.user import User, UserRole
from app.models.doctor import Doctor
from app.models.appointment import Appointment, AppointmentStatus
from app.models.session_log import SessionLog
from app.schemas.session_log import SessionLogUpsert, SessionLogResponse
from app.api.deps import get_current_user

router = APIRouter(tags=["Nota clínica"])


def _check_doctor_access(db: Session, current_user: User, appt: Appointment) -> bool:
    if current_user.role == UserRole.admin:
        return True
    if current_user.role == UserRole.doctor:
        doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
        return doctor and doctor.id == appt.doctor_id
    return False


@router.get("/appointments/{appointment_id}/session-log", response_model=SessionLogResponse | None)
def get_session_log(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lee la nota clínica. Visible para el médico de la cita, paciente dueño, y admin/recepción."""
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    is_patient = appt.patient_id == current_user.id
    is_staff = current_user.role in (UserRole.admin, UserRole.receptionist)
    is_appt_doctor = False
    if current_user.role == UserRole.doctor:
        doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
        is_appt_doctor = doctor and doctor.id == appt.doctor_id
    if not (is_patient or is_staff or is_appt_doctor):
        raise HTTPException(status_code=403, detail="Sin permisos")

    return db.query(SessionLog).filter(SessionLog.appointment_id == appointment_id).first()


@router.put("/appointments/{appointment_id}/session-log", response_model=SessionLogResponse)
def upsert_session_log(
    appointment_id: int,
    data: SessionLogUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crea o actualiza la nota clínica. Solo el médico de la cita (o admin) puede.

    Si `is_draft=False`, marca la cita como `completed` automáticamente.
    """
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    if not _check_doctor_access(db, current_user, appt):
        raise HTTPException(status_code=403, detail="Sin permisos")

    log = db.query(SessionLog).filter(SessionLog.appointment_id == appointment_id).first()
    payload = data.model_dump()
    if not log:
        log = SessionLog(appointment_id=appointment_id, **payload)
        db.add(log)
    else:
        for k, v in payload.items():
            setattr(log, k, v)

    # Si se finaliza la nota, la cita queda completada.
    if not data.is_draft and appt.status != AppointmentStatus.completed:
        appt.status = AppointmentStatus.completed
        appointments_completed.inc()

    db.commit()
    db.refresh(log)
    return log
