import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Date, ForeignKey, Enum as SAEnum, Index,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class HomeworkStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"


class HomeworkAssignment(Base):
    """Tarea/ejercicio asignado por el profesional al paciente entre sesiones.

    Ejemplos: 10 min de mindfulness diario, leer un capítulo, journaling con prompt,
    ejercicio de respiración 4-7-8, etc.
    """
    __tablename__ = "homework_assignments"
    __table_args__ = (
        Index("ix_homework_patient_status", "patient_id", "status"),
        Index("ix_homework_doctor_status", "doctor_id", "status"),
    )

    id              = Column(Integer, primary_key=True, index=True)
    doctor_id       = Column(Integer, ForeignKey("doctors.id"), nullable=False, index=True)
    patient_id      = Column(Integer, ForeignKey("users.id"),   nullable=False, index=True)
    title           = Column(String(200), nullable=False)
    description     = Column(Text, default="")
    due_date        = Column(Date, nullable=True, index=True)
    status          = Column(SAEnum(HomeworkStatus), nullable=False, default=HomeworkStatus.pending)
    patient_feedback = Column(Text, default="")
    created_at      = Column(DateTime, default=datetime.utcnow)
    completed_at    = Column(DateTime, nullable=True)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    doctor  = relationship("Doctor")
    patient = relationship("User", foreign_keys=[patient_id])
