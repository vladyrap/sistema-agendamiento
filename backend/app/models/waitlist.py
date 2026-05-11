import enum
from datetime import datetime
from sqlalchemy import Column, Integer, Date, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class WaitlistStatus(str, enum.Enum):
    pending = "pending"      # esperando
    notified = "notified"    # le avisamos que se liberó
    satisfied = "satisfied"  # ya reservó
    cancelled = "cancelled"  # paciente o sistema canceló


class Waitlist(Base):
    """Paciente en lista de espera para citas con un médico en un rango de fechas."""
    __tablename__ = "waitlist"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False, index=True)
    desired_from = Column(Date, nullable=False)  # ventana inicio (inclusivo)
    desired_to = Column(Date, nullable=False)    # ventana fin (inclusivo)
    status = Column(Enum(WaitlistStatus), default=WaitlistStatus.pending, nullable=False, index=True)
    notified_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("User", foreign_keys=[patient_id])
    doctor = relationship("Doctor")
