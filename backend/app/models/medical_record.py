from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models._types import EncryptedText


class MedicalRecord(Base):
    """Ficha médica básica del paciente. Una por paciente.

    Los campos de salud (alergias, condiciones crónicas, medicamentos, notas)
    están encriptados at-rest con Fernet. `blood_type` y los contactos de
    emergencia quedan en claro porque no son datos clínicos sensibles per se
    y se filtran/buscan más seguido.
    """
    __tablename__ = "medical_records"
    __table_args__ = (UniqueConstraint("patient_id", name="uq_medrec_patient"),)

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)

    blood_type = Column(String(8))                # ej. "O+"
    allergies = Column(EncryptedText)              # texto libre, encriptado
    chronic_conditions = Column(EncryptedText)     # texto libre, encriptado
    medications = Column(EncryptedText)            # texto libre, encriptado
    emergency_contact_name = Column(String(120))
    emergency_contact_phone = Column(String(40))
    notes = Column(EncryptedText)                  # texto libre, encriptado

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("User", foreign_keys=[patient_id])
