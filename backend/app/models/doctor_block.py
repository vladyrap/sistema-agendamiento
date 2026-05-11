from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class DoctorBlock(Base):
    """Bloque de fechas en que el médico no atiende (vacaciones, congreso, etc.)."""
    __tablename__ = "doctor_blocks"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False, index=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)  # inclusivo
    reason = Column(String(200))
    created_at = Column(DateTime, default=datetime.utcnow)

    doctor = relationship("Doctor")
