from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    specialty_id = Column(Integer, ForeignKey("specialties.id"), nullable=False)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    license_number = Column(String(50), unique=True, nullable=False)
    consultation_duration = Column(Integer, default=30)  # minutes
    consultation_price = Column(Integer, default=0, nullable=False)  # CLP. 0 = sin pago.
    bio = Column(Text)
    is_active = Column(Boolean, default=True)

    user = relationship("User", back_populates="doctor_profile", foreign_keys=[user_id])
    specialty = relationship("Specialty", back_populates="doctors")
    clinic = relationship("Clinic", back_populates="doctors")
    availabilities = relationship("DoctorAvailability", back_populates="doctor")
    appointments = relationship(
        "Appointment", back_populates="doctor", foreign_keys="Appointment.doctor_id"
    )
    reviews = relationship("Review", back_populates="doctor", cascade="all, delete-orphan")

    @property
    def rating_avg(self):
        if not self.reviews:
            return None
        return round(sum(r.rating for r in self.reviews) / len(self.reviews), 1)

    @property
    def rating_count(self):
        return len(self.reviews) if self.reviews else 0
