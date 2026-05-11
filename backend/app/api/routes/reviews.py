from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.appointment import Appointment, AppointmentStatus
from app.models.review import Review
from app.models.doctor import Doctor
from app.models.user import User, UserRole
from app.schemas.review import ReviewCreate, ReviewResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/reviews", tags=["Reseñas"])


@router.post("/", response_model=ReviewResponse, status_code=201)
def create_review(
    data: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appt = (
        db.query(Appointment)
        .filter(Appointment.id == data.appointment_id)
        .first()
    )
    if not appt:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    if appt.patient_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Sin permisos")
    if appt.status != AppointmentStatus.completed:
        raise HTTPException(status_code=400, detail="Solo puedes calificar citas completadas")

    if db.query(Review).filter(Review.appointment_id == data.appointment_id).first():
        raise HTTPException(status_code=409, detail="Esta cita ya fue calificada")

    review = Review(
        appointment_id=appt.id,
        patient_id=appt.patient_id,
        doctor_id=appt.doctor_id,
        rating=data.rating,
        comment=data.comment,
    )
    db.add(review)
    db.commit()
    return (
        db.query(Review)
        .options(joinedload(Review.patient))
        .filter(Review.id == review.id)
        .first()
    )


@router.get("/doctor/{doctor_id}", response_model=List[ReviewResponse])
def list_doctor_reviews(doctor_id: int, db: Session = Depends(get_db)):
    if not db.query(Doctor).filter(Doctor.id == doctor_id).first():
        raise HTTPException(status_code=404, detail="Médico no encontrado")
    return (
        db.query(Review)
        .options(joinedload(Review.patient))
        .filter(Review.doctor_id == doctor_id)
        .order_by(Review.created_at.desc())
        .all()
    )


@router.get("/appointment/{appointment_id}", response_model=ReviewResponse | None)
def get_appointment_review(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Devuelve la reseña existente de una cita, o null si aún no hay."""
    review = (
        db.query(Review)
        .options(joinedload(Review.patient))
        .filter(Review.appointment_id == appointment_id)
        .first()
    )
    return review
