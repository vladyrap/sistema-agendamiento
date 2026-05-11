from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.clinic import Clinic
from app.models.user import User
from app.schemas.clinic import ClinicCreate, ClinicUpdate, ClinicResponse
from app.api.deps import require_admin

router = APIRouter(prefix="/clinics", tags=["Clínicas"])


@router.get("/", response_model=List[ClinicResponse])
def list_clinics(db: Session = Depends(get_db)):
    return db.query(Clinic).filter(Clinic.is_active == True).all()


@router.get("/{clinic_id}", response_model=ClinicResponse)
def get_clinic(clinic_id: int, db: Session = Depends(get_db)):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clínica no encontrada")
    return clinic


@router.post("/", response_model=ClinicResponse, status_code=201)
def create_clinic(
    data: ClinicCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    clinic = Clinic(**data.model_dump())
    db.add(clinic)
    db.commit()
    db.refresh(clinic)
    return clinic


@router.put("/{clinic_id}", response_model=ClinicResponse)
def update_clinic(
    clinic_id: int,
    data: ClinicUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clínica no encontrada")
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(clinic, key, value)
    db.commit()
    db.refresh(clinic)
    return clinic
