"""Modelos para campañas Ley Karin (21.643): assessment de riesgo psicosocial.

Una empresa contrata (o un consultor crea) una campaña, se genera un link
público anónimo, los trabajadores responden, el sistema agrega el reporte por
dimensión. NO se guarda PII del respondedor (no email, no nombre, no IP visible).
"""
import enum
import secrets
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Enum as SAEnum,
    JSON, Index,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class LeyKarinAssessmentStatus(str, enum.Enum):
    draft  = "draft"   # creada, todavía no se envía a trabajadores
    active = "active"  # link compartible activo, recibe respuestas
    closed = "closed"  # cerrada, no recibe más respuestas


def _new_token() -> str:
    return secrets.token_urlsafe(24)


class LeyKarinAssessment(Base):
    """Campaña de assessment de riesgo psicosocial para una empresa."""
    __tablename__ = "leykarin_assessments"
    __table_args__ = (
        Index("ix_leykarin_company_status", "company_id", "status"),
        Index("ix_leykarin_share_token", "share_token", unique=True),
    )

    id              = Column(Integer, primary_key=True, index=True)
    company_id      = Column(Integer, ForeignKey("companies.id"), nullable=False)
    consultant_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Consultor a cargo (opcional)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    title           = Column(String(200), nullable=False)
    instrument_code = Column(String(50), nullable=False, default="suseso_istas21_short")
    status          = Column(SAEnum(LeyKarinAssessmentStatus), nullable=False, default=LeyKarinAssessmentStatus.draft)

    share_token     = Column(String(64), nullable=False, default=_new_token, unique=True, index=True)
    target_employees = Column(Integer, nullable=True)  # tamaño aproximado, para mostrar % completado
    notes           = Column(Text, default="")

    response_count  = Column(Integer, default=0, nullable=False)
    closed_at       = Column(DateTime, nullable=True)
    closed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    company         = relationship("Company", foreign_keys=[company_id])
    consultant      = relationship("User", foreign_keys=[consultant_user_id])
    created_by      = relationship("User", foreign_keys=[created_by_user_id])
    closed_by       = relationship("User", foreign_keys=[closed_by_user_id])
    responses       = relationship("LeyKarinResponse", back_populates="assessment", cascade="all, delete-orphan")


class LeyKarinResponse(Base):
    """Respuesta anónima de un/a trabajador/a al cuestionario.

    NO contiene PII. Solo metadata demográfica opcional para análisis agregado.
    """
    __tablename__ = "leykarin_responses"
    __table_args__ = (
        Index("ix_leykarin_response_assessment", "assessment_id"),
    )

    id              = Column(Integer, primary_key=True, index=True)
    assessment_id   = Column(Integer, ForeignKey("leykarin_assessments.id"), nullable=False)

    # Respuestas: {"exigencias_1": 3, "exigencias_2": 1, ...}
    answers           = Column(JSON, nullable=False)
    # Scores cacheados al momento de submit: {"exigencias": {"raw_score": 8, "level": "medium", ...}, ...}
    dimension_scores  = Column(JSON, nullable=True)

    # Metadata demográfica OPCIONAL (no identifica)
    meta_age_range    = Column(String(20), nullable=True)    # "menos_30" | "30_49" | "50_mas"
    meta_tenure       = Column(String(20), nullable=True)    # "menos_1" | "1_5" | "mas_5"
    meta_department   = Column(String(120), nullable=True)
    meta_gender       = Column(String(20), nullable=True)    # "f" | "m" | "nb" | "ns_nc"

    # Auditoría liviana (hash de IP para detectar duplicados, NO ip directa)
    ip_hash           = Column(String(64), nullable=True)
    submitted_at      = Column(DateTime, default=datetime.utcnow, nullable=False)

    assessment        = relationship("LeyKarinAssessment", back_populates="responses")
