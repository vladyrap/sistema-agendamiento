from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class TutorCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    relationship_label: str = Field(min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=50)
    rut: Optional[str] = Field(default=None, max_length=20)
    is_legal_guardian: bool = False
    notify_on_crisis: bool = True
    notify_on_appointments: bool = False
    can_view_full_profile: bool = True
    notes: Optional[str] = ""


class TutorUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    relationship_label: Optional[str] = Field(default=None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    rut: Optional[str] = None
    is_legal_guardian: Optional[bool] = None
    notify_on_crisis: Optional[bool] = None
    notify_on_appointments: Optional[bool] = None
    can_view_full_profile: Optional[bool] = None
    notes: Optional[str] = None


class TutorResponse(BaseModel):
    id: int
    patient_id: int
    tutor_user_id: Optional[int] = None
    has_account: bool = False  # true si tutor_user_id está poblado
    name: str
    relationship_label: str
    email: Optional[str] = None
    phone: Optional[str] = None
    rut: Optional[str] = None
    is_legal_guardian: bool
    notify_on_crisis: bool
    notify_on_appointments: bool
    can_view_full_profile: bool
    notes: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TutorPatientSummary(BaseModel):
    """Para el dashboard del tutor: cada paciente del que es tutor."""
    patient_id: int
    patient_name: str
    patient_email: str
    is_legal_guardian: bool
    relationship_label: str
    # Snapshot rápido
    mood_score_latest: Optional[int] = None
    mood_date_latest: Optional[str] = None  # ISO date
    next_appointment_date: Optional[str] = None
    next_appointment_time: Optional[str] = None
    pending_homework: int = 0


class AlertTutorRequest(BaseModel):
    """Cuando el doctor quiere mandar manualmente una alerta al tutor."""
    message: Optional[str] = Field(default="", max_length=2000)


class DoctorTutorItem(BaseModel):
    """Tutor visto desde el doctor: incluye info del paciente al que pertenece."""
    tutor_id: int
    tutor_user_id: Optional[int] = None
    has_account: bool = False
    name: str
    relationship_label: str
    email: Optional[str] = None
    phone: Optional[str] = None
    rut: Optional[str] = None
    is_legal_guardian: bool
    notify_on_crisis: bool
    notify_on_appointments: bool
    notes: str
    # Paciente al que pertenece
    patient_id: int
    patient_name: str
    patient_is_minor: bool = False
