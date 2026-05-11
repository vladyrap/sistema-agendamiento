from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class PatientNoteUpdate(BaseModel):
    content: str


class PatientNoteResponse(BaseModel):
    id: int
    doctor_id: int
    patient_id: int
    content: str
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
