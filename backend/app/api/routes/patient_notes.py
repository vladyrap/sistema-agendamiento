"""Notas privadas del médico sobre un paciente."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.doctor import Doctor
from app.models.patient_note import PatientNote
from app.schemas.patient_note import PatientNoteResponse, PatientNoteUpdate
from app.api.deps import get_current_user

router = APIRouter(prefix="/patient-notes", tags=["Notas médicas"])


def _doctor_for_user(db: Session, user: User) -> Doctor:
    if user.role != UserRole.doctor:
        raise HTTPException(status_code=403, detail="Solo médicos pueden gestionar notas privadas")
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Perfil de médico no encontrado")
    return doctor


@router.get("/{patient_id}", response_model=PatientNoteResponse)
def get_note(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor = _doctor_for_user(db, current_user)
    note = db.query(PatientNote).filter(
        PatientNote.doctor_id == doctor.id,
        PatientNote.patient_id == patient_id,
    ).first()
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor = _doctor_for_user(db, current_user)
    note = db.query(PatientNote).filter(
        PatientNote.doctor_id == doctor.id,
        PatientNote.patient_id == patient_id,
    ).first()
    if not note:
        note = PatientNote(doctor_id=doctor.id, patient_id=patient_id, content=data.content)
        db.add(note)
    else:
        note.content = data.content
    db.commit()
    db.refresh(note)
    return note
