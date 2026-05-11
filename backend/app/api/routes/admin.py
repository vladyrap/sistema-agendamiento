from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.doctor import Doctor
from app.models.appointment import Appointment, AppointmentStatus
from app.schemas.user import UserResponse, UserUpdate
from app.schemas.doctor import AdminDoctorCreate, DoctorResponse
from app.schemas.staff import ReceptionistCreate
from app.api.deps import require_admin

router = APIRouter(prefix="/admin", tags=["Administración"])


@router.get("/users", response_model=List[UserResponse])
def list_users(
    role: Optional[UserRole] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    return query.all()


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}/toggle-active", response_model=UserResponse)
def toggle_user_active(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return user


@router.post("/doctors", response_model=DoctorResponse, status_code=201)
def create_doctor_with_user(
    data: AdminDoctorCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    if data.rut and db.query(User).filter(User.rut == data.rut).first():
        raise HTTPException(status_code=400, detail="El RUT ya está registrado")
    if db.query(Doctor).filter(Doctor.license_number == data.license_number).first():
        raise HTTPException(status_code=400, detail="Número de licencia ya registrado")

    user = User(
        email=data.email,
        password_hash=get_password_hash(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        rut=data.rut,
        role=UserRole.doctor,
    )
    db.add(user)
    db.flush()

    doctor = Doctor(
        user_id=user.id,
        specialty_id=data.specialty_id,
        clinic_id=data.clinic_id,
        license_number=data.license_number,
        consultation_duration=data.consultation_duration,
        consultation_price=data.consultation_price,
        bio=data.bio,
    )
    db.add(doctor)
    db.commit()

    return (
        db.query(Doctor)
        .options(joinedload(Doctor.user), joinedload(Doctor.specialty))
        .filter(Doctor.id == doctor.id)
        .first()
    )


@router.post("/receptionists", response_model=UserResponse, status_code=201)
def create_receptionist(
    data: ReceptionistCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Crea un usuario con rol recepcionista."""
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    if data.rut and db.query(User).filter(User.rut == data.rut).first():
        raise HTTPException(status_code=400, detail="El RUT ya está registrado")

    user = User(
        email=data.email,
        password_hash=get_password_hash(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        rut=data.rut,
        role=UserRole.receptionist,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    total_users = db.query(func.count(User.id)).scalar()
    total_patients = db.query(func.count(User.id)).filter(User.role == UserRole.patient).scalar()
    total_doctors = db.query(func.count(Doctor.id)).filter(Doctor.is_active == True).scalar()
    total_appointments = db.query(func.count(Appointment.id)).scalar()
    appointments_by_status = (
        db.query(Appointment.status, func.count(Appointment.id))
        .group_by(Appointment.status)
        .all()
    )
    return {
        "total_users": total_users,
        "total_patients": total_patients,
        "total_doctors": total_doctors,
        "total_appointments": total_appointments,
        "appointments_by_status": {s: c for s, c in appointments_by_status},
    }


@router.get("/appointments", response_model=List[dict])
def list_all_appointments(
    status_filter: Optional[AppointmentStatus] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    from sqlalchemy.orm import joinedload
    query = db.query(Appointment).options(
        joinedload(Appointment.patient),
        joinedload(Appointment.doctor),
    )
    if status_filter:
        query = query.filter(Appointment.status == status_filter)
    appointments = query.order_by(Appointment.appointment_date.desc()).limit(200).all()
    return [
        {
            "id": a.id,
            "patient": f"{a.patient.first_name} {a.patient.last_name}",
            "doctor": f"{a.doctor.user.first_name} {a.doctor.user.last_name}" if a.doctor.user else "",
            "date": str(a.appointment_date),
            "start_time": str(a.start_time),
            "status": a.status,
        }
        for a in appointments
    ]
