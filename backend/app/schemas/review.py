from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from .user import UserResponse


class ReviewCreate(BaseModel):
    appointment_id: int
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None


class ReviewResponse(BaseModel):
    id: int
    appointment_id: int
    doctor_id: int
    rating: int
    comment: Optional[str]
    created_at: datetime
    patient: UserResponse

    class Config:
        from_attributes = True


class DoctorRating(BaseModel):
    avg: Optional[float] = None
    count: int = 0
