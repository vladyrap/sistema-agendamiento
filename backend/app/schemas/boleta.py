from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models.boleta import BoletaStatus


class BoletaCreate(BaseModel):
    """Crear una boleta manualmente (caso raro: consultoría suelta sin cita)."""
    patient_id: int
    amount_clp: int = Field(gt=0)
    service_date: date
    glosa: str = "Atención psicológica"
    appointment_id: Optional[int] = None
    notes: Optional[str] = ""


class BoletaUpdate(BaseModel):
    glosa: Optional[str] = None
    amount_clp: Optional[int] = Field(default=None, gt=0)
    notes: Optional[str] = None


class BoletaIssue(BaseModel):
    """Marcar boleta como emitida — el psicólogo/a tipea el folio SII."""
    folio: str = Field(min_length=1, max_length=50)
    emitted_at: Optional[datetime] = None  # default: ahora


class BoletaResponse(BaseModel):
    id: int
    doctor_id: int
    patient_id: int
    appointment_id: Optional[int] = None
    amount_clp: int
    glosa: str
    service_date: date
    status: BoletaStatus
    folio: Optional[str] = None
    emitted_at: Optional[datetime] = None
    attachment_id: Optional[int] = None
    notes: Optional[str] = ""
    created_at: datetime
    updated_at: datetime
    # campos enriquecidos
    patient_name: Optional[str] = None
    patient_rut: Optional[str] = None
    patient_email: Optional[str] = None
    doctor_name: Optional[str] = None
    appointment_date: Optional[date] = None

    class Config:
        from_attributes = True


class BoletaListResponse(BaseModel):
    items: List[BoletaResponse]
    pending_count: int
    issued_count: int
    pending_amount_clp: int
