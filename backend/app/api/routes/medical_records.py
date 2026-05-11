"""Ficha médica del paciente. El paciente edita la suya; staff/médico puede leerla."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.medical_record import MedicalRecord
from app.schemas.medical_record import MedicalRecordResponse, MedicalRecordUpdate
from app.api.deps import get_current_user

router = APIRouter(tags=["Ficha clínica"])


def _get_or_create(db: Session, patient_id: int) -> MedicalRecord:
    rec = db.query(MedicalRecord).filter(MedicalRecord.patient_id == patient_id).first()
    if not rec:
        rec = MedicalRecord(patient_id=patient_id)
        db.add(rec)
        db.commit()
        db.refresh(rec)
    return rec


@router.get("/me/medical-record", response_model=MedicalRecordResponse)
def get_my_record(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_or_create(db, current_user.id)


@router.put("/me/medical-record", response_model=MedicalRecordResponse)
def update_my_record(
    data: MedicalRecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rec = _get_or_create(db, current_user.id)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(rec, k, v)
    db.commit()
    db.refresh(rec)
    return rec


@router.get("/patients/{patient_id}/medical-record", response_model=MedicalRecordResponse)
def get_patient_record(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lectura por staff/médico. Médico solo si tiene cita con el paciente — para MVP simplificamos
    permitiendo a cualquier doctor/recepción/admin consultarla."""
    if current_user.role not in (UserRole.doctor, UserRole.receptionist, UserRole.admin):
        raise HTTPException(status_code=403, detail="Sin permisos")
    target = db.query(User).filter(User.id == patient_id, User.role == UserRole.patient).first()
    if not target:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    return _get_or_create(db, patient_id)
