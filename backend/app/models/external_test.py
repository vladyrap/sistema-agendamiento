from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base


class ExternalTestResult(Base):
    """Resultado de un test psicológico aplicado FUERA del sistema digital.

    Pensado para tests con copyright o que requieren administración presencial
    (WAIS, Rorschach, MMPI, BDI-II, BAI, DASS-21, MoCA, etc.).

    El profesional aplica el test con sus propios materiales licenciados y
    registra acá: nombre del test, fecha, score, severidad, interpretación,
    fecha de re-evaluación, y opcionalmente un PDF del informe técnico.
    """
    __tablename__ = "external_test_results"
    __table_args__ = (
        Index("ix_extt_patient", "patient_id"),
        Index("ix_extt_doctor", "doctor_id"),
    )

    id            = Column(Integer, primary_key=True, index=True)
    patient_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    doctor_id     = Column(Integer, ForeignKey("doctors.id"), nullable=False)

    # Identificación del test
    test_code     = Column(String(50), nullable=False)  # ej: 'wais4', 'rorschach', 'other'
    test_name     = Column(String(200), nullable=False)  # display, especialmente si test_code='other'

    # Resultado
    applied_at    = Column(Date, nullable=False)
    score         = Column(String(100), nullable=True)  # texto libre: '85', 'P75', '12 (T-score 65)', etc.
    severity_label = Column(String(100), nullable=True)  # texto libre: 'Normal', 'Leve', 'Moderado', etc.
    interpretation = Column(Text, nullable=True)  # interpretación clínica
    follow_up_date = Column(Date, nullable=True)  # fecha sugerida para reaplicar

    # Adjunto opcional (PDF del informe completo)
    attachment_id = Column(Integer, ForeignKey("medical_attachments.id"), nullable=True)

    notes         = Column(Text, default="")
    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient    = relationship("User", foreign_keys=[patient_id])
    doctor     = relationship("Doctor", foreign_keys=[doctor_id])
    attachment = relationship("MedicalAttachment", foreign_keys=[attachment_id])
