from datetime import datetime
from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


class PatientNote(Base):
    """Notas privadas del médico sobre un paciente. Solo visible al médico autor.

    Una entrada por par (doctor, paciente) — el contenido se acumula con el tiempo.
    """
    __tablename__ = "patient_notes"
    __table_args__ = (UniqueConstraint("doctor_id", "patient_id", name="uq_patnote_doctor_patient"),)

    id = Column(Integer, primary_key=True, index=True)
    doctor_id  = Column(Integer, ForeignKey("doctors.id"), nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"),   nullable=False, index=True)
    content    = Column(Text, default="")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    doctor  = relationship("Doctor")
    patient = relationship("User", foreign_keys=[patient_id])
