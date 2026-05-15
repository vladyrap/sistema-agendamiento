from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, ForeignKey, Boolean, String, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models._types import EncryptedText


class SessionLog(Base):
    """Nota clínica estructurada asociada a una cita.

    Todos los campos de texto clínico están encriptados at-rest. `risk_level`
    queda en claro porque es enum chico (low/medium/high) y se filtra/agrega
    en dashboards.

    Un único log por cita. Mientras `is_draft=True` no se considera finalizada.
    Cuando el médico la finaliza, marcamos la cita como `completed`.
    """
    __tablename__ = "session_logs"
    __table_args__ = (UniqueConstraint("appointment_id", name="uq_sessionlog_appointment"),)

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False, index=True)

    # ── Comunes (medicina general, psicología) — encriptados ──
    diagnosis = Column(EncryptedText)
    evolution = Column(EncryptedText)
    observations = Column(EncryptedText)
    indications = Column(EncryptedText)
    treatment = Column(EncryptedText)
    medications = Column(EncryptedText)
    next_steps = Column(EncryptedText)

    # ── Específicos de psicología — encriptados ──
    emotional_state = Column(EncryptedText)
    topics_discussed = Column(EncryptedText)
    therapeutic_goals = Column(EncryptedText)
    progress_notes = Column(EncryptedText)
    homework = Column(EncryptedText)
    risk_level = Column(String(10))  # low / medium / high — en claro para reporting

    is_draft = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    appointment = relationship("Appointment")
