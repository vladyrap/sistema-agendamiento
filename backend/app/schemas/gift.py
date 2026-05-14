from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


# ─── Compra ───────────────────────────────────────────────────────────────

class GiftPackage(BaseModel):
    """Paquete predefinido visible públicamente."""
    code: str
    name: str
    description: str
    amount_clp: int
    sessions_approx: int  # cuántas sesiones aprox equivale (referencial)
    highlight: bool = False


class GiftPurchase(BaseModel):
    amount_clp: int = Field(ge=5000, le=2_000_000)
    buyer_name: str = Field(min_length=2, max_length=200)
    buyer_email: EmailStr
    recipient_name: str = Field(min_length=2, max_length=200)
    recipient_email: EmailStr
    message: Optional[str] = Field(default="", max_length=1000)


class GiftPurchaseResponse(BaseModel):
    gift_card_id: int
    code: str
    amount_clp: int
    status: str
    checkout_url: Optional[str] = None  # URL de MercadoPago si aplica


# ─── Canje ────────────────────────────────────────────────────────────────

class GiftRedeem(BaseModel):
    code: str = Field(min_length=4, max_length=24)


class GiftRedeemResponse(BaseModel):
    success: bool
    amount_credited_clp: int
    new_balance_clp: int
    message: str = ""


# ─── Vistas ───────────────────────────────────────────────────────────────

class MyCredit(BaseModel):
    balance_clp: int = 0
    total_earned: int = 0
    total_spent: int = 0


class CreditTransactionResponse(BaseModel):
    id: int
    amount_clp: int
    type: str
    description: str
    balance_after: int
    appointment_id: Optional[int] = None
    gift_card_id: Optional[int] = None
    created_at: datetime


class GiftCardResponse(BaseModel):
    id: int
    code: str
    amount_clp: int
    status: str
    buyer_name: Optional[str] = None
    buyer_email: Optional[str] = None
    recipient_name: str
    recipient_email: str
    message: str = ""
    paid_at: Optional[datetime] = None
    email_sent_at: Optional[datetime] = None
    redeemed_at: Optional[datetime] = None
    redeemed_by_user_id: Optional[int] = None
    created_at: Optional[datetime] = None
