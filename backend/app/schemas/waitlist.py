from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel
from app.models.waitlist import WaitlistStatus
from .user import UserResponse
from .doctor import DoctorListResponse


class WaitlistCreate(BaseModel):
    doctor_id: int
    desired_from: date
    desired_to: date


class WaitlistResponse(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    desired_from: date
    desired_to: date
    status: WaitlistStatus
    notified_at: Optional[datetime]
    created_at: datetime
    patient: Optional[UserResponse] = None
    doctor: Optional[DoctorListResponse] = None

    class Config:
        from_attributes = True
