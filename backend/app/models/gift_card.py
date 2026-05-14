from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Index, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class GiftCard(Base):
    """Gift card de Calmar: una persona compra crédito para regalárselo a otra.

    Estados:
      - pending_payment: creada, esperando pago en MercadoPago
      - active: pagada y enviada al destinatario, esperando que la canjee
      - redeemed: canjeada, el crédito ya está en el balance del destinatario
      - expired: pasó su fecha de expiración sin canjear
      - cancelled: cancelada (refund, problema con pago, etc.)
    """
    __tablename__ = "gift_cards"
    __table_args__ = (
        Index("ix_giftcard_recipient_email", "recipient_email"),
        Index("ix_giftcard_status", "status"),
    )

    id              = Column(Integer, primary_key=True, index=True)
    code            = Column(String(24), unique=True, index=True, nullable=False)
    amount_clp      = Column(Integer, nullable=False)  # monto en CLP

    # Comprador (puede ser anónimo si compra sin loguearse)
    buyer_user_id   = Column(Integer, ForeignKey("users.id"), nullable=True)
    buyer_name      = Column(String(200), nullable=True)
    buyer_email     = Column(String(255), nullable=True)

    # Destinatario
    recipient_name  = Column(String(200), nullable=False)
    recipient_email = Column(String(255), nullable=False)
    message         = Column(Text, default="")

    # Estado
    status          = Column(String(20), default="pending_payment", nullable=False)
    redeemed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    redeemed_at     = Column(DateTime, nullable=True)

    # MercadoPago
    mp_preference_id = Column(String(120), nullable=True)
    mp_payment_id   = Column(String(120), nullable=True)
    paid_at         = Column(DateTime, nullable=True)

    # Email tracking
    email_sent_at   = Column(DateTime, nullable=True)

    expires_at      = Column(DateTime, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    buyer_user     = relationship("User", foreign_keys=[buyer_user_id])
    redeemed_by    = relationship("User", foreign_keys=[redeemed_by_user_id])


class UserCredit(Base):
    """Saldo de un usuario, alimentado por gift cards canjeadas o devoluciones."""
    __tablename__ = "user_credits"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    balance_clp   = Column(Integer, default=0, nullable=False)
    total_earned  = Column(Integer, default=0, nullable=False)
    total_spent   = Column(Integer, default=0, nullable=False)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


class CreditTransaction(Base):
    """Movimientos del balance del usuario (auditoría)."""
    __tablename__ = "credit_transactions"
    __table_args__ = (Index("ix_credittx_user_created", "user_id", "created_at"),)

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount_clp   = Column(Integer, nullable=False)   # +canje, -uso
    type         = Column(String(40), nullable=False)  # gift_redeemed | appointment_used | refund | admin_adjust
    description  = Column(Text, default="")
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    gift_card_id   = Column(Integer, ForeignKey("gift_cards.id"), nullable=True)
    balance_after  = Column(Integer, nullable=False)  # saldo después de este movimiento
    created_at   = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
