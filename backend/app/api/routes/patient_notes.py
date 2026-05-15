"""Notas privadas del médico sobre un paciente."""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.doctor import Doctor
from app.models.patient_note import PatientNote
from app.schemas.patient_note import PatientNoteResponse, PatientNoteUpdate
from app.api.deps import get_current_user
from app.services import audit

router = APIRouter(prefix="/patient-notes", tags=["Notas clínicas"])


def _doctor_for_user(db: Session, user: User) -> Doctor:
    if user.role != UserRole.doctor:
        raise HTTPException(status_code=403, detail="Solo psicólogos/as pueden gestionar notas privadas")
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Perfil de psicólogo/a no encontrado")
    return doctor


@router.get("/{patient_id}", response_model=PatientNoteResponse)
def get_note(
    patient_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor = _doctor_for_user(db, current_user)
    note = db.query(PatientNote).filter(
        PatientNote.doctor_id == doctor.id,
        PatientNote.patient_id == patient_id,
    ).first()
    audit.log_access(
        db, current_user, audit.RESOURCE_PATIENT_NOTE, audit.ACTION_VIEW,
        resource_id=note.id if note else None, patient_id=patient_id, request=request,
    )
    if not note:
        # Devolvemos un objeto "vacío" sin persistir hasta que escriban algo.
        return PatientNoteResponse(
            id=0, doctor_id=doctor.id, patient_id=patient_id, content="", updated_at=None,
        )
    return note


@router.put("/{patient_id}", response_model=PatientNoteResponse)
def upsert_note(
    patient_id: int,
    data: PatientNoteUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor = _doctor_for_user(db, current_user)
    note = db.query(PatientNote).filter(
        PatientNote.doctor_id == doctor.id,
        PatientNote.patient_id == patient_id,
    ).first()
    action = audit.ACTION_UPDATE if note else audit.ACTION_CREATE
    if not note:
        note = PatientNote(doctor_id=doctor.id, patient_id=patient_id, content=data.content)
        db.add(note)
    else:
        note.content = data.content
    db.commit()
    db.refresh(note)
    audit.log_access(
        db, current_user, audit.RESOURCE_PATIENT_NOTE, action,
        resource_id=note.id, patient_id=patient_id, request=request,
    )
    return note
