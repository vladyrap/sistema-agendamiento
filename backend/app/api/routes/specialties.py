from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.specialty import Specialty
from app.schemas.specialty import SpecialtyCreate, SpecialtyUpdate, SpecialtyResponse
from app.api.deps import get_current_user, require_admin
from app.models.user import User

router = APIRouter(prefix="/specialties", tags=["Especialidades"])


@router.get("/", response_model=List[SpecialtyResponse])
def list_specialties(db: Session = Depends(get_db)):
    return db.query(Specialty).filter(Specialty.is_active == True).all()


@router.get("/{specialty_id}", response_model=SpecialtyResponse)
def get_specialty(specialty_id: int, db: Session = Depends(get_db)):
    specialty = db.query(Specialty).filter(Specialty.id == specialty_id).first()
    if not specialty:
        raise HTTPException(status_code=404, detail="Especialidad no encontrada")
    return specialty


@router.post("/", response_model=SpecialtyResponse, status_code=201)
def create_specialty(
    data: SpecialtyCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    if db.query(Specialty).filter(Specialty.name == data.name).first():
        raise HTTPException(status_code=400, detail="Especialidad ya existe")
    specialty = Specialty(**data.model_dump())
    db.add(specialty)
    db.commit()
    db.refresh(specialty)
    return specialty


@router.put("/{specialty_id}", response_model=SpecialtyResponse)
def update_specialty(
    specialty_id: int,
    data: SpecialtyUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    specialty = db.query(Specialty).filter(Specialty.id == specialty_id).first()
    if not specialty:
        raise HTTPException(status_code=404, detail="Especialidad no encontrada")
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(specialty, key, value)
    db.commit()
    db.refresh(specialty)
    return specialty


@router.delete("/{specialty_id}", status_code=204)
def delete_specialty(
    specialty_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    specialty = db.query(Specialty).filter(Specialty.id == specialty_id).first()
    if not specialty:
        raise HTTPException(status_code=404, detail="Especialidad no encontrada")
    specialty.is_active = False
    db.commit()
