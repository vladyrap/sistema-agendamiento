from datetime import time, date
from typing import Optional, List
from pydantic import BaseModel


class AvailabilityBase(BaseModel):
    day_of_week: int  # 0=Monday, 6=Sunday
    start_time: time
    end_time: time


class AvailabilityCreate(AvailabilityBase):
    pass


class AvailabilityUpdate(BaseModel):
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_active: Optional[bool] = None


class AvailabilityResponse(AvailabilityBase):
    id: int
    doctor_id: int
    is_active: bool

    class Config:
        from_attributes = True


class TimeSlot(BaseModel):
    start_time: str
    end_time: str
    available: bool


class AvailableSlotsResponse(BaseModel):
    doctor_id: int
    date: date
    slots: List[TimeSlot]
