import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, Date, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class UserRole(str, enum.Enum):
    patient = "patient"
    doctor = "doctor"
    admin = "admin"
    receptionist = "receptionist"
    tutor = "tutor"
    company_admin = "company_admin"


# Estados clínicos del paciente. Estado distinto de is_active (que es bloqueo de la cuenta).
PATIENT_STATUSES = ("active", "in_treatment", "inactive", "discharged")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(20))
    rut = Column(String(20), unique=True, index=True)
    role = Column(Enum(UserRole), default=UserRole.patient, nullable=False)
    is_active = Column(Boolean, default=True)

    # Datos personales / clínicos del paciente. Nullable para no romper usuarios existentes.
    birth_date = Column(Date)
    address = Column(Text)
    health_insurance = Column(String(100))  # Fonasa A/B/C/D, Isapre Banmédica, etc.
    patient_status = Column(String(30), default="active")  # ver PATIENT_STATUSES
    assigned_doctor_id = Column(Integer, ForeignKey("doctors.id"))
    photo_url = Column(String(500))  # URL pública de la foto de perfil (CDN, pravatar, etc.)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    doctor_profile = relationship("Doctor", back_populates="user", uselist=False, foreign_keys="Doctor.user_id")
    assigned_doctor = relationship("Doctor", foreign_keys=[assigned_doctor_id])
    appointments_as_patient = relationship(
        "Appointment", back_populates="patient", foreign_keys="Appointment.patient_id"
    )
