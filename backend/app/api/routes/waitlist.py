"""Lista de espera: paciente se anota, sistema le avisa cuando se libera un cupo."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.doctor import Doctor
from app.models.waitlist import Waitlist, WaitlistStatus
from app.schemas.waitlist import WaitlistCreate, WaitlistResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/waitlist", tags=["Lista de espera"])


@router.post("/", response_model=WaitlistResponse, status_code=201)
def join_waitlist(
    data: WaitlistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.desired_to < data.desired_from:
        raise HTTPException(status_code=400, detail="Rango de fechas inválido")

    if not db.query(Doctor).filter(Doctor.id == data.doctor_id, Doctor.is_active == True).first():
        raise HTTPException(status_code=404, detail="Médico no encontrado")

    # Evitar duplicados pendientes para el mismo paciente+médico
    existing = db.query(Waitlist).filter(
        Waitlist.patient_id == current_user.id,
        Waitlist.doctor_id == data.doctor_id,
        Waitlist.status == WaitlistStatus.pending,
    ).first()
    if existing:
        existing.desired_from = data.desired_from
        existing.desired_to = data.desired_to
        db.commit()
        db.refresh(existing)
        return _load(db, existing.id)

    entry = Waitlist(
        patient_id=current_user.id,
        doctor_id=data.doctor_id,
        desired_from=data.desired_from,
        desired_to=data.desired_to,
    )
    db.add(entry)
    db.commit()
    return _load(db, entry.id)


@router.get("/me", response_model=List[WaitlistResponse])
def my_waitlist_entries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Waitlist)
        .options(
            joinedload(Waitlist.patient),
            joinedload(Waitlist.doctor).joinedload(Doctor.user),
            joinedload(Waitlist.doctor).joinedload(Doctor.specialty),
        )
        .filter(Waitlist.patient_id == current_user.id)
        .order_by(Waitlist.created_at.desc())
        .all()
    )


@router.delete("/{entry_id}", status_code=204)
def leave_waitlist(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.query(Waitlist).filter(Waitlist.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entrada no encontrada")
    if entry.patient_id != current_user.id and current_user.role not in (UserRole.admin, UserRole.receptionist):
        raise HTTPException(status_code=403, detail="Sin permisos")
    entry.status = WaitlistStatus.cancelled
    db.commit()


def _load(db: Session, entry_id: int) -> Waitlist:
    return (
        db.query(Waitlist)
        .options(
            joinedload(Waitlist.patient),
            joinedload(Waitlist.doctor).joinedload(Doctor.user),
            joinedload(Waitlist.doctor).joinedload(Doctor.specialty),
        )
        .filter(Waitlist.id == entry_id)
        .first()
    )
