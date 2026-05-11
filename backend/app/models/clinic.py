from sqlalchemy import Column, Integer, String, Boolean, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class Clinic(Base):
    __tablename__ = "clinics"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    address = Column(String(300))
    city = Column(String(100))
    phone = Column(String(20))
    email = Column(String(255))
    description = Column(Text)
    is_active = Column(Boolean, default=True)

    doctors = relationship("Doctor", back_populates="clinic")
