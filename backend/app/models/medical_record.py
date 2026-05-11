from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


class MedicalRecord(Base):
    """Ficha médica básica del paciente. Una por paciente."""
    __tablename__ = "medical_records"
    __table_args__ = (UniqueConstraint("patient_id", name="uq_medrec_patient"),)

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)

    blood_type = Column(String(8))                # ej. "O+"
    allergies = Column(Text)                       # texto libre
    chronic_conditions = Column(Text)              # texto libre
    medications = Column(Text)                     # texto libre
    emergency_contact_name = Column(String(120))
    emergency_contact_phone = Column(String(40))
    notes = Column(Text)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("User", foreign_keys=[patient_id])
