"""Bloques de ausencia del médico (vacaciones, congresos, etc.)."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.redis_client import cache_delete_pattern
from app.models.user import User, UserRole
from app.models.doctor import Doctor
from app.models.doctor_block import DoctorBlock
from app.schemas.doctor_block import DoctorBlockCreate, DoctorBlockResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/doctor-blocks", tags=["Bloques de ausencia"])


def _doctor_for_user(db: Session, user: User) -> Doctor:
    if user.role != UserRole.doctor:
        raise HTTPException(status_code=403, detail="Solo psicólogos/as pueden gestionar sus ausencias")
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Perfil de psicólogo/a no encontrado")
    return doctor


@router.get("/me", response_model=List[DoctorBlockResponse])
def list_my_blocks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor = _doctor_for_user(db, current_user)
    return (
        db.query(DoctorBlock)
        .filter(DoctorBlock.doctor_id == doctor.id)
        .order_by(DoctorBlock.start_date)
        .all()
    )


@router.post("/me", response_model=DoctorBlockResponse, status_code=201)
def create_block(
    data: DoctorBlockCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor = _doctor_for_user(db, current_user)
    if data.end_date < data.start_date:
        raise HTTPException(status_code=400, detail="La fecha fin no puede ser anterior al inicio")

    block = DoctorBlock(
        doctor_id=doctor.id,
        start_date=data.start_date,
        end_date=data.end_date,
        reason=data.reason,
    )
    db.add(block)
    db.commit()
    db.refresh(block)

    cache_delete_pattern(f"slots:doctor:{doctor.id}:*")
    return block


@router.delete("/me/{block_id}", status_code=204)
def delete_block(
    block_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor = _doctor_for_user(db, current_user)
    block = db.query(DoctorBlock).filter(
        DoctorBlock.id == block_id,
        DoctorBlock.doctor_id == doctor.id,
    ).first()
    if not block:
        raise HTTPException(status_code=404, detail="Bloque no encontrado")
    db.delete(block)
    db.commit()
    cache_delete_pattern(f"slots:doctor:{doctor.id}:*")
