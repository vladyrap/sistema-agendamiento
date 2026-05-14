from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Date, ForeignKey, JSON, Index, Boolean,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class QuestionnaireAssignment(Base):
    """Asignación de un cuestionario psicológico a un paciente.

    El catálogo de cuestionarios vive en código Python (services/questionnaires_catalog.py).
    Esta tabla guarda solo asignaciones + respuestas.

    Estados:
      - pending: doctor lo asignó, paciente no lo ha respondido
      - completed: paciente respondió y se calculó el score
    """
    __tablename__ = "questionnaire_assignments"
    __table_args__ = (
        Index("ix_qassign_patient_code", "patient_id", "code"),
        Index("ix_qassign_doctor_status", "doctor_id", "status"),
    )

    id          = Column(Integer, primary_key=True, index=True)
    doctor_id   = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    patient_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    code        = Column(String(50), nullable=False)  # 'phq9', 'gad7', 'who5'
    status      = Column(String(20), default='pending', nullable=False, index=True)
    due_date    = Column(Date, nullable=True)
    doctor_note = Column(Text, default="")

    # Filled when completed
    answers          = Column(JSON, nullable=True)   # {"0": 2, "1": 0, ...}
    score            = Column(Integer, nullable=True)
    max_score        = Column(Integer, nullable=True)
    severity_code    = Column(String(50), nullable=True)
    severity_label   = Column(String(100), nullable=True)
    severity_tone    = Column(String(20), nullable=True)
    action_hint      = Column(Text, nullable=True)
    crisis_flagged   = Column(Boolean, default=False, nullable=False)
    patient_comment  = Column(Text, default="")

    created_at   = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    doctor  = relationship("Doctor")
    patient = relationship("User", foreign_keys=[patient_id])
