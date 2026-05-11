from datetime import date, timedelta, datetime, time
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload, selectinload
from app.core.database import get_db
from app.core.redis_client import cache_get, cache_set, cache_delete_pattern
from app.core.metrics import slot_lookup_latency
from app.models.doctor import Doctor
from app.models.availability import DoctorAvailability
from app.models.appointment import Appointment, AppointmentStatus
from app.models.doctor_block import DoctorBlock
from app.models.user import User, UserRole
from app.schemas.doctor import DoctorCreate, DoctorUpdate, DoctorResponse, DoctorListResponse
from app.schemas.availability import (
    AvailabilityCreate, AvailabilityResponse, AvailableSlotsResponse, TimeSlot
)
from app.api.deps import get_current_user, require_admin, require_doctor

router = APIRouter(prefix="/doctors", tags=["Médicos"])


@router.get("/", response_model=List[DoctorListResponse])
def list_doctors(
    specialty_id: Optional[int] = Query(None),
    clinic_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Doctor)
        .options(
            joinedload(Doctor.user),
            joinedload(Doctor.specialty),
            selectinload(Doctor.reviews),
        )
        .filter(Doctor.is_active == True)
    )
    if specialty_id:
        query = query.filter(Doctor.specialty_id == specialty_id)
    if clinic_id:
        query = query.filter(Doctor.clinic_id == clinic_id)
    return query.all()


@router.get("/me", response_model=DoctorResponse)
def get_my_doctor_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Devuelve el perfil de médico del usuario actual. Solo válido si current_user.role == doctor."""
    doctor = (
        db.query(Doctor)
        .options(
            joinedload(Doctor.user),
            joinedload(Doctor.specialty),
            selectinload(Doctor.reviews),
        )
        .filter(Doctor.user_id == current_user.id)
        .first()
    )
    if not doctor:
        raise HTTPException(status_code=404, detail="No tienes un perfil de médico asociado")
    return doctor


@router.get("/{doctor_id}", response_model=DoctorResponse)
def get_doctor(doctor_id: int, db: Session = Depends(get_db)):
    doctor = (
        db.query(Doctor)
        .options(
            joinedload(Doctor.user),
            joinedload(Doctor.specialty),
            selectinload(Doctor.reviews),
        )
        .filter(Doctor.id == doctor_id)
        .first()
    )
    if not doctor:
        raise HTTPException(status_code=404, detail="Médico no encontrado")
    return doctor


@router.post("/", response_model=DoctorResponse, status_code=201)
def create_doctor(
    data: DoctorCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if db.query(Doctor).filter(Doctor.license_number == data.license_number).first():
        raise HTTPException(status_code=400, detail="Número de licencia ya registrado")
    doctor = Doctor(**data.model_dump())
    user.role = UserRole.doctor
    db.add(doctor)
    db.commit()
    db.refresh(doctor)
    return doctor


@router.put("/{doctor_id}", response_model=DoctorResponse)
def update_doctor(
    doctor_id: int,
    data: DoctorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Médico no encontrado")
    if current_user.role != UserRole.admin and doctor.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin permisos")
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(doctor, key, value)
    db.commit()
    db.refresh(doctor)
    return doctor


# --- Availability ---

@router.get("/{doctor_id}/availability", response_model=List[AvailabilityResponse])
def get_doctor_availability(doctor_id: int, db: Session = Depends(get_db)):
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Médico no encontrado")
    return (
        db.query(DoctorAvailability)
        .filter(DoctorAvailability.doctor_id == doctor_id, DoctorAvailability.is_active == True)
        .all()
    )


@router.post("/{doctor_id}/availability", response_model=AvailabilityResponse, status_code=201)
def set_doctor_availability(
    doctor_id: int,
    data: AvailabilityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Médico no encontrado")
    if current_user.role != UserRole.admin and doctor.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin permisos")
    avail = DoctorAvailability(doctor_id=doctor_id, **data.model_dump())
    db.add(avail)
    db.commit()
    db.refresh(avail)
    cache_delete_pattern(f"slots:doctor:{doctor_id}:*")
    return avail


@router.get("/{doctor_id}/available-slots", response_model=AvailableSlotsResponse)
@slot_lookup_latency.time()
def get_available_slots(
    doctor_id: int,
    query_date: date = Query(..., alias="date"),
    db: Session = Depends(get_db),
):
    cache_key = f"slots:doctor:{doctor_id}:{query_date}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Médico no encontrado")

    # Día completo bloqueado por ausencia
    block = (
        db.query(DoctorBlock)
        .filter(
            DoctorBlock.doctor_id == doctor_id,
            DoctorBlock.start_date <= query_date,
            DoctorBlock.end_date >= query_date,
        )
        .first()
    )
    if block:
        result = AvailableSlotsResponse(doctor_id=doctor_id, date=query_date, slots=[])
        cache_set(cache_key, result.model_dump(), ttl=300)
        return result

    day_of_week = query_date.weekday()
    availability = (
        db.query(DoctorAvailability)
        .filter(
            DoctorAvailability.doctor_id == doctor_id,
            DoctorAvailability.day_of_week == day_of_week,
            DoctorAvailability.is_active == True,
        )
        .first()
    )
    if not availability:
        result = AvailableSlotsResponse(doctor_id=doctor_id, date=query_date, slots=[])
        cache_set(cache_key, result.model_dump(), ttl=300)
        return result

    booked = {
        appt.start_time
        for appt in db.query(Appointment).filter(
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_date == query_date,
            Appointment.status.in_([AppointmentStatus.scheduled, AppointmentStatus.confirmed]),
        ).all()
    }

    slots = []
    current = datetime.combine(query_date, availability.start_time)
    end = datetime.combine(query_date, availability.end_time)
    duration = timedelta(minutes=doctor.consultation_duration)

    while current + duration <= end:
        slot_start = current.time()
        slot_end = (current + duration).time()
        slots.append(TimeSlot(
            start_time=slot_start.strftime("%H:%M"),
            end_time=slot_end.strftime("%H:%M"),
            available=slot_start not in booked,
        ))
        current += duration

    result = AvailableSlotsResponse(doctor_id=doctor_id, date=query_date, slots=slots)
    cache_set(cache_key, result.model_dump(), ttl=300)
    return result
