from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class MedicalRecordBase(BaseModel):
    blood_type: Optional[str] = None
    allergies: Optional[str] = None
    chronic_conditions: Optional[str] = None
    medications: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    notes: Optional[str] = None


class MedicalRecordUpdate(MedicalRecordBase):
    pass


class MedicalRecordResponse(MedicalRecordBase):
    id: int
    patient_id: int
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
