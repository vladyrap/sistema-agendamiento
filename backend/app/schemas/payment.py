from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.payment import PaymentStatus


class PaymentResponse(BaseModel):
    id: int
    appointment_id: int
    amount: int
    currency: str
    status: PaymentStatus
    provider: str
    checkout_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CheckoutResponse(BaseModel):
    """Respuesta del endpoint que crea la preferencia de pago."""
    payment_id: int
    checkout_url: str
    status: PaymentStatus
