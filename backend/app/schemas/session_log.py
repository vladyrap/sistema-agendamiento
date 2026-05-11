from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class SessionLogBase(BaseModel):
    diagnosis: Optional[str] = None
    evolution: Optional[str] = None
    observations: Optional[str] = None
    indications: Optional[str] = None
    treatment: Optional[str] = None
    medications: Optional[str] = None
    next_steps: Optional[str] = None

    emotional_state: Optional[str] = None
    topics_discussed: Optional[str] = None
    therapeutic_goals: Optional[str] = None
    progress_notes: Optional[str] = None
    homework: Optional[str] = None
    risk_level: Optional[str] = None


class SessionLogUpsert(SessionLogBase):
    is_draft: bool = True


class SessionLogResponse(SessionLogBase):
    id: int
    appointment_id: int
    is_draft: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
