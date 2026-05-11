import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class PaymentStatus(str, enum.Enum):
    pending  = "pending"
    approved = "approved"
    rejected = "rejected"
    refunded = "refunded"
    cancelled = "cancelled"


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False, index=True)
    amount = Column(Integer, nullable=False)  # CLP no usa decimales
    currency = Column(String(8), nullable=False, default="CLP")
    status = Column(Enum(PaymentStatus), default=PaymentStatus.pending, nullable=False, index=True)
    provider = Column(String(32), nullable=False, default="mercadopago")
    provider_id = Column(String(128), index=True)        # preference id
    provider_payment_id = Column(String(128), index=True) # payment id (after webhook)
    checkout_url = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    appointment = relationship("Appointment", back_populates="payments")
