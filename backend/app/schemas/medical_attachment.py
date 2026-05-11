from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.medical_attachment import AttachmentCategory


class AttachmentResponse(BaseModel):
    id: int
    patient_id: int
    appointment_id: Optional[int]
    file_name: str
    content_type: str
    size_bytes: int
    category: AttachmentCategory
    note: Optional[str]
    uploaded_by_id: int
    uploaded_at: datetime

    class Config:
        from_attributes = True
