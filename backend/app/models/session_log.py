from datetime import datetime
from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, Boolean, String, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


class SessionLog(Base):
    """Nota clínica estructurada asociada a una cita.

    Un único log por cita. Mientras `is_draft=True` no se considera finalizada.
    Cuando el médico la finaliza, marcamos la cita como `completed`.
    """
    __tablename__ = "session_logs"
    __table_args__ = (UniqueConstraint("appointment_id", name="uq_sessionlog_appointment"),)

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False, index=True)

    # ── Comunes (medicina general, psicología) ──
    diagnosis = Column(Text)
    evolution = Column(Text)
    observations = Column(Text)
    indications = Column(Text)
    treatment = Column(Text)
    medications = Column(Text)
    next_steps = Column(Text)

    # ── Específicos de psicología ──
    emotional_state = Column(Text)
    topics_discussed = Column(Text)
    therapeutic_goals = Column(Text)
    progress_notes = Column(Text)
    homework = Column(Text)
    risk_level = Column(String(10))  # low / medium / high

    is_draft = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    appointment = relationship("Appointment")
