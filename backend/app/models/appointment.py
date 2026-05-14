import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, Text, Date, Time
from sqlalchemy.orm import relationship
from app.core.database import Base


class AppointmentStatus(str, enum.Enum):
    scheduled = "scheduled"
    confirmed = "confirmed"
    cancelled = "cancelled"
    completed = "completed"
    no_show = "no_show"


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    appointment_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    status = Column(Enum(AppointmentStatus), default=AppointmentStatus.scheduled)
    modality = Column(String(20), default="in_person", nullable=False)  # in_person | online
    meeting_room_token = Column(String(64))  # solo si modality=online
    reminder_sent = Column(Boolean, default=False, nullable=False)
    reason = Column(Text)
    notes = Column(Text)
    cancellation_reason = Column(String(300))
    # Si la cita fue cubierta por el pool de una empresa (convenio B2B):
    paid_by_company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    # Crédito de gift cards usado para esta cita (en CLP):
    paid_by_credit_clp = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("User", back_populates="appointments_as_patient", foreign_keys=[patient_id])
    doctor = relationship("Doctor", back_populates="appointments", foreign_keys=[doctor_id])
    payments = relationship("Payment", back_populates="appointment", cascade="all, delete-orphan")
