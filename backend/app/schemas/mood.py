from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


class MoodCheckIn(BaseModel):
    score: int = Field(ge=1, le=10, description="Estado de ánimo 1 (muy mal) a 10 (excelente)")
    note: Optional[str] = Field(default="", max_length=1000)
    date: Optional[date] = None  # default = hoy


class MoodEntryResponse(BaseModel):
    id: int
    patient_id: int
    date: date
    score: int
    note: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MoodSummary(BaseModel):
    """Resumen agregado para tarjetas / dashboard."""
    days_logged: int
    current_streak: int
    average_30d: Optional[float] = None
    average_7d: Optional[float] = None
    latest: Optional[MoodEntryResponse] = None


class DoctorMoodFeedItem(BaseModel):
    """Fila del feed de 'amanecidas' del doctor — última entrada por paciente."""
    patient_id: int
    patient_name: str
    patient_email: Optional[str] = None
    entry_id: int
    date: date
    score: int
    note: str
    next_appointment_date: Optional[date] = None  # próxima cita con este doctor si existe
