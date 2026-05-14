from datetime import datetime, date, time
from typing import Optional
from pydantic import BaseModel
from app.models.appointment import AppointmentStatus
from .user import UserResponse
from .doctor import DoctorListResponse


class AppointmentCreate(BaseModel):
    doctor_id: int
    appointment_date: date
    start_time: time
    reason: Optional[str] = None
    modality: str = "in_person"  # in_person | online
    # Solo staff (admin/recepcionista) puede setear este campo, ignorado para pacientes.
    patient_id: Optional[int] = None
    # Repetir la cita semanalmente N veces más después de la primera.
    # repeat_weeks=0 → solo la cita base. repeat_weeks=4 → 5 citas en total.
    repeat_weeks: int = 0
    # Usar crédito de gift cards al reservar.
    use_credit: bool = True


class CancelDayRequest(BaseModel):
    date: date
    reason: Optional[str] = None


class CancelDayResponse(BaseModel):
    cancelled: int


class AppointmentUpdate(BaseModel):
    appointment_date: Optional[date] = None
    start_time: Optional[time] = None
    reason: Optional[str] = None


class AppointmentReschedule(BaseModel):
    appointment_date: date
    start_time: time


class AppointmentCancel(BaseModel):
    cancellation_reason: Optional[str] = None


class AppointmentResponse(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    appointment_date: date
    start_time: time
    end_time: time
    status: AppointmentStatus
    reason: Optional[str]
    notes: Optional[str]
    cancellation_reason: Optional[str]
    created_at: datetime
    patient: UserResponse
    doctor: DoctorListResponse

    modality: str = "in_person"
    meeting_room_token: Optional[str] = None
    # Si la cita requiere pago, el backend devuelve la URL de checkout
    # de MercadoPago. El frontend redirige a esa URL.
    checkout_url: Optional[str] = None
    payment_status: Optional[str] = None

    class Config:
        from_attributes = True


class AppointmentSummary(BaseModel):
    id: int
    appointment_date: date
    start_time: time
    end_time: time
    status: AppointmentStatus
    reason: Optional[str]
    patient: UserResponse
    doctor: DoctorListResponse
    modality: str = "in_person"
    payment_status: Optional[str] = None

    class Config:
        from_attributes = True
