import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Text, BigInteger
from sqlalchemy.orm import relationship
from app.core.database import Base


class AttachmentCategory(str, enum.Enum):
    imaging = "imaging"               # radiografías, ecografías, TAC, RM, DICOM
    lab = "lab"                       # exámenes de laboratorio
    medical_exam = "medical_exam"     # examen médico general
    psychological_report = "psychological_report"  # informe psicológico
    prescription = "prescription"     # recetas
    consent = "consent"               # consentimientos firmados
    certificate = "certificate"       # certificados
    referral = "referral"             # derivaciones / interconsultas
    other = "other"


class MedicalAttachment(Base):
    """Archivos adjuntos a la ficha clínica del paciente (imagenología, exámenes, recetas)."""
    __tablename__ = "medical_attachments"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True, index=True)

    file_name = Column(String(255), nullable=False)         # nombre original
    storage_path = Column(String(500), nullable=False)      # ruta relativa a UPLOAD_DIR
    content_type = Column(String(120), nullable=False)
    size_bytes = Column(BigInteger, nullable=False)
    category = Column(Enum(AttachmentCategory), default=AttachmentCategory.other, nullable=False)
    note = Column(Text)

    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("User", foreign_keys=[patient_id])
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])
