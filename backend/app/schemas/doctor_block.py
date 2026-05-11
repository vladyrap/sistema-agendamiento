from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class DoctorBlockCreate(BaseModel):
    start_date: date
    end_date: date
    reason: Optional[str] = None


class DoctorBlockResponse(BaseModel):
    id: int
    doctor_id: int
    start_date: date
    end_date: date
    reason: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
