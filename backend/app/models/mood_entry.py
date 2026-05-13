from datetime import datetime, date as date_type
from sqlalchemy import Column, Integer, Text, DateTime, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


class MoodEntry(Base):
    """Una entrada del diario emocional del paciente — una por día.

    Permite al profesional ver la evolución del estado de ánimo del paciente
    entre sesiones, enriqueciendo el contexto clínico.
    """
    __tablename__ = "mood_entries"
    __table_args__ = (
        UniqueConstraint("patient_id", "date", name="uq_mood_patient_date"),
    )

    id          = Column(Integer, primary_key=True, index=True)
    patient_id  = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    date        = Column(Date, nullable=False, index=True)
    score       = Column(Integer, nullable=False)  # 1 (muy mal) — 10 (excelente)
    note        = Column(Text, default="")
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("User", foreign_keys=[patient_id])
