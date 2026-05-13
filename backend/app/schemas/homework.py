from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


class HomeworkCreate(BaseModel):
    patient_id: int
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = ""
    due_date: Optional[date] = None


class HomeworkUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    due_date: Optional[date] = None


class HomeworkComplete(BaseModel):
    patient_feedback: Optional[str] = Field(default="", max_length=2000)


class HomeworkResponse(BaseModel):
    id: int
    doctor_id: int
    doctor_name: Optional[str] = None
    doctor_specialty: Optional[str] = None
    patient_id: int
    patient_name: Optional[str] = None
    title: str
    description: str
    due_date: Optional[date] = None
    status: str
    patient_feedback: str
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class HomeworkStats(BaseModel):
    total: int
    pending: int
    completed: int
    overdue: int
    completion_rate: Optional[float] = None  # 0.0 a 1.0
