from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, UniqueConstraint, Index,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class TutorRelationship(Base):
    """Relación tutor ↔ paciente.

    Un tutor puede ser un User con role=tutor (puede loguearse y ver al paciente),
    o un contacto suelto (solo email/teléfono) que solo se notifica.

    Cuando se agrega un tutor por email y existe un User con ese email + role=tutor,
    se vincula automáticamente.
    """
    __tablename__ = "tutor_relationships"
    __table_args__ = (
        # Un mismo tutor (por user_id) no puede aparecer 2 veces para el mismo paciente
        UniqueConstraint("patient_id", "tutor_user_id", name="uq_tutor_patient_user"),
        Index("ix_tutor_patient", "patient_id"),
        Index("ix_tutor_user", "tutor_user_id"),
    )

    id          = Column(Integer, primary_key=True, index=True)
    patient_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    tutor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # nullable: contacto suelto

    # Datos de contacto (siempre presentes, son el "snapshot")
    name         = Column(String(200), nullable=False)
    relationship_label = Column(String(100), nullable=False)  # "Padre", "Madre", "Pareja", "Tutor legal"...
    email        = Column(String(255), nullable=True, index=True)
    phone        = Column(String(50), nullable=True)
    rut          = Column(String(20), nullable=True)

    # Flags de tipo / permisos
    is_legal_guardian       = Column(Boolean, default=False, nullable=False)
    notify_on_crisis        = Column(Boolean, default=True, nullable=False)
    notify_on_appointments  = Column(Boolean, default=False, nullable=False)
    can_view_full_profile   = Column(Boolean, default=True, nullable=False)

    notes      = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient    = relationship("User", foreign_keys=[patient_id])
    tutor_user = relationship("User", foreign_keys=[tutor_user_id])
