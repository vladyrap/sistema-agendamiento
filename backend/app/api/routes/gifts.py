"""Gift Cards de Calmar — regalar crédito para sesiones a otra persona.

Flujo de compra:
1. Comprador llena form (puede no estar logueado): monto, sus datos, datos del destinatario, mensaje
2. POST /api/gifts/buy → crea GiftCard en estado pending_payment + preferencia MercadoPago
3. Comprador paga en MP
4. Webhook MercadoPago activa la card → email al destinatario con código
5. Destinatario se registra (si no tiene cuenta) y canjea el código
6. El crédito queda en su balance, listo para usar en reservas
"""
import secrets
import string
import logging
from datetime import datetime, timedelta
from typing import List, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.gift_card import GiftCard, UserCredit, CreditTransaction
from app.schemas.gift import (
    GiftPackage, GiftPurchase, GiftPurchaseResponse,
    GiftRedeem, GiftRedeemResponse,
    MyCredit, CreditTransactionResponse, GiftCardResponse,
)
from app.services import payments as payments_service
from app.services.notifications import enqueue
from app.api.deps import get_current_user, require_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/gifts", tags=["Gift Cards"])


# ─── Catálogo de paquetes ─────────────────────────────────────────────────

PACKAGES = [
    GiftPackage(
        code="single", name="Una sesión",
        description="Una consulta con cualquier profesional verificado.",
        amount_clp=25_000, sessions_approx=1,
    ),
    GiftPackage(
        code="bundle4", name="Pack 4 sesiones",
        description="Para acompañar un proceso completo. Ahorra 10%.",
        amount_clp=90_000, sessions_approx=4, highlight=True,
    ),
    GiftPackage(
        code="bundle8", name="Pack 8 sesiones",
        description="Un trimestre de cuidado emocional. Ahorra 15%.",
        amount_clp=170_000, sessions_approx=8,
    ),
]


# ─── Utilidades ──────────────────────────────────────────────────────────

def _generate_code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # sin O, 0, I, 1, etc. para legibilidad
    part1 = "".join(secrets.choice(alphabet) for _ in range(4))
    part2 = "".join(secrets.choice(alphabet) for _ in range(4))
    return f"CALMAR-{part1}-{part2}"


def _ensure_user_credit(db: Session, user_id: int) -> UserCredit:
    uc = db.query(UserCredit).filter(UserCredit.user_id == user_id).first()
    if not uc:
        uc = UserCredit(user_id=user_id, balance_clp=0)
        db.add(uc)
        db.flush()
    return uc


def _serialize(g: GiftCard) -> GiftCardResponse:
    return GiftCardResponse(
        id=g.id,
        code=g.code,
        amount_clp=g.amount_clp,
        status=g.status,
        buyer_name=g.buyer_name,
        buyer_email=g.buyer_email,
        recipient_name=g.recipient_name,
        recipient_email=g.recipient_email,
        message=g.message or "",
        paid_at=g.paid_at,
        email_sent_at=g.email_sent_at,
        redeemed_at=g.redeemed_at,
        redeemed_by_user_id=g.redeemed_by_user_id,
        created_at=g.created_at,
    )


# ─── Endpoints públicos ──────────────────────────────────────────────────

@router.get("/packages", response_model=List[GiftPackage])
def list_packages():
    """Paquetes predefinidos. Endpoint público."""
    return PACKAGES


@router.post("/buy", response_model=GiftPurchaseResponse, status_code=201)
def buy_gift(
    data: GiftPurchase,
    db: Session = Depends(get_db),
):
    """Compra una gift card. NO requiere autenticación.

    Si MercadoPago está habilitado, devuelve checkout_url.
    Si no, la card queda en estado 'active' inmediatamente (modo dev).
    """
    code = _generate_code()
    # Asegurarse de que no exista (probabilidad ínfima pero...)
    while db.query(GiftCard).filter(GiftCard.code == code).first():
        code = _generate_code()

    card = GiftCard(
        code=code,
        amount_clp=data.amount_clp,
        buyer_name=data.buyer_name,
        buyer_email=data.buyer_email.lower(),
        recipient_name=data.recipient_name,
        recipient_email=data.recipient_email.lower(),
        message=data.message or "",
        status="pending_payment",
        expires_at=datetime.utcnow() + timedelta(days=365),  # 1 año para canjear
    )
    db.add(card)
    db.commit()
    db.refresh(card)

    # Crear preferencia de pago
    checkout_url: Optional[str] = None
    if payments_service.is_enabled():
        try:
            base = settings.APP_PUBLIC_URL.rstrip("/")
            # Usamos external_reference con prefijo 'gift:' para diferenciar del flujo de citas
            preference = _create_gift_preference(
                gift_card_id=card.id,
                code=card.code,
                amount=card.amount_clp,
                buyer_email=card.buyer_email,
                public_url=base,
            )
            if preference:
                card.mp_preference_id = preference["id"]
                checkout_url = preference["checkout_url"]
                db.commit()
        except Exception:
            logger.exception("gift.preference_create_failed")

    # Si NO está habilitado MP (dev), activamos directamente y mandamos email
    if not payments_service.is_enabled():
        card.status = "active"
        card.paid_at = datetime.utcnow()
        db.commit()
        _send_gift_email(card)

    return GiftPurchaseResponse(
        gift_card_id=card.id,
        code=card.code,
        amount_clp=card.amount_clp,
        status=card.status,
        checkout_url=checkout_url,
    )


def _create_gift_preference(*, gift_card_id: int, code: str, amount: int, buyer_email: str, public_url: str):
    """Crea preferencia MercadoPago para una gift card."""
    try:
        import mercadopago
    except Exception:
        return None
    sdk = mercadopago.SDK(settings.MP_ACCESS_TOKEN)
    parsed = urlparse(public_url)
    notification_url = None
    if parsed.hostname and parsed.hostname not in ("localhost", "127.0.0.1"):
        notification_url = f"{public_url}/api/webhooks/mercadopago"

    pref_data = {
        "items": [{
            "title": "Gift Card Calmar"[:250],
            "quantity": 1,
            "unit_price": float(amount),
            "currency_id": "CLP",
        }],
        "external_reference": f"gift:{gift_card_id}",
        "back_urls": {
            "success": f"{public_url}/regalar?status=success&code={code}",
            "failure": f"{public_url}/regalar?status=failure",
            "pending": f"{public_url}/regalar?status=pending",
        },
        "auto_return": "approved",
        "statement_descriptor": "Calmar Gift",
    }
    if buyer_email:
        pref_data["payer"] = {"email": buyer_email}
    if notification_url:
        pref_data["notification_url"] = notification_url

    result = sdk.preference().create(pref_data)
    if result.get("status") not in (200, 201):
        logger.error("gift.preference_bad_response", extra={"resp": result.get("response")})
        return None
    pref = result["response"]
    is_sandbox = (settings.MP_ACCESS_TOKEN or "").startswith("TEST-")
    return {
        "id": pref["id"],
        "checkout_url": pref["sandbox_init_point"] if is_sandbox else pref["init_point"],
    }


def _send_gift_email(card: GiftCard):
    """Encolar email al destinatario con el código."""
    enqueue("gift_card_active", {
        "recipient_role": "gift_recipient",
        "to_email": card.recipient_email,
        "to_name": card.recipient_name,
        "buyer_name": card.buyer_name or "Alguien",
        "amount_clp": card.amount_clp,
        "code": card.code,
        "message": card.message or "",
    })
    card.email_sent_at = datetime.utcnow()


def activate_gift_card_by_external_reference(db: Session, external_reference: str, mp_payment_id: Optional[str] = None):
    """Llamada desde el webhook MP cuando se aprueba un pago de gift card."""
    if not external_reference.startswith("gift:"):
        return None
    try:
        gift_id = int(external_reference.split(":", 1)[1])
    except (IndexError, ValueError):
        return None
    card = db.query(GiftCard).filter(GiftCard.id == gift_id).first()
    if not card:
        return None
    if card.status == "active" or card.status == "redeemed":
        return card  # idempotente
    card.status = "active"
    card.paid_at = datetime.utcnow()
    if mp_payment_id:
        card.mp_payment_id = mp_payment_id
    db.commit()
    _send_gift_email(card)
    db.commit()
    return card


# ─── Canje y crédito (usuario logueado) ─────────────────────────────────

@router.post("/redeem", response_model=GiftRedeemResponse)
def redeem(
    data: GiftRedeem,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.patient, UserRole.tutor, UserRole.company_admin):
        raise HTTPException(status_code=403, detail="Solo pacientes pueden canjear gift cards")

    code = data.code.strip().upper()
    card = db.query(GiftCard).filter(GiftCard.code == code).first()
    if not card:
        raise HTTPException(status_code=404, detail="Código no encontrado")
    if card.status == "pending_payment":
        raise HTTPException(status_code=400, detail="Esta gift card aún no fue pagada")
    if card.status == "redeemed":
        raise HTTPException(status_code=400, detail="Esta gift card ya fue canjeada")
    if card.status == "expired":
        raise HTTPException(status_code=400, detail="Esta gift card expiró")
    if card.status != "active":
        raise HTTPException(status_code=400, detail=f"Estado inválido: {card.status}")
    if card.expires_at and card.expires_at < datetime.utcnow():
        card.status = "expired"
        db.commit()
        raise HTTPException(status_code=400, detail="Esta gift card expiró")

    # Acreditar al usuario
    uc = _ensure_user_credit(db, current_user.id)
    uc.balance_clp += card.amount_clp
    uc.total_earned += card.amount_clp

    card.status = "redeemed"
    card.redeemed_by_user_id = current_user.id
    card.redeemed_at = datetime.utcnow()

    tx = CreditTransaction(
        user_id=current_user.id,
        amount_clp=card.amount_clp,
        type="gift_redeemed",
        description=f"Canje de gift card de {card.buyer_name or 'alguien especial'}",
        gift_card_id=card.id,
        balance_after=uc.balance_clp,
    )
    db.add(tx)
    db.commit()

    return GiftRedeemResponse(
        success=True,
        amount_credited_clp=card.amount_clp,
        new_balance_clp=uc.balance_clp,
        message=f"¡Listo! Se sumaron ${card.amount_clp:,} CLP a tu saldo.".replace(",", "."),
    )


@router.get("/me/credit", response_model=MyCredit)
def my_credit(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    uc = db.query(UserCredit).filter(UserCredit.user_id == current_user.id).first()
    if not uc:
        return MyCredit()
    return MyCredit(
        balance_clp=uc.balance_clp,
        total_earned=uc.total_earned,
        total_spent=uc.total_spent,
    )


@router.get("/me/transactions", response_model=List[CreditTransactionResponse])
def my_transactions(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(CreditTransaction)
        .filter(CreditTransaction.user_id == current_user.id)
        .order_by(CreditTransaction.created_at.desc())
        .limit(limit)
        .all()
    )
    return [CreditTransactionResponse(
        id=t.id,
        amount_clp=t.amount_clp,
        type=t.type,
        description=t.description or "",
        balance_after=t.balance_after,
        appointment_id=t.appointment_id,
        gift_card_id=t.gift_card_id,
        created_at=t.created_at,
    ) for t in rows]


@router.get("/me/sent", response_model=List[GiftCardResponse])
def my_sent_gifts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Gift cards que el usuario regaló (si compró logueado)."""
    rows = (
        db.query(GiftCard)
        .filter(
            (GiftCard.buyer_user_id == current_user.id) |
            (GiftCard.buyer_email == current_user.email.lower())
        )
        .order_by(GiftCard.created_at.desc())
        .all()
    )
    return [_serialize(c) for c in rows]


# ─── Admin ────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[GiftCardResponse])
def list_all(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    q = db.query(GiftCard)
    if status:
        q = q.filter(GiftCard.status == status)
    rows = q.order_by(GiftCard.created_at.desc()).limit(500).all()
    return [_serialize(c) for c in rows]


# ─── Helper para descuento en booking ─────────────────────────────────────

def use_credit_for_appointment(db: Session, user_id: int, appointment_id: int, amount_to_use: int) -> int:
    """Descuenta del balance del usuario y lo aplica a la cita.

    Returns: cuánto efectivamente se descontó (puede ser menos si el balance es menor).
    """
    if amount_to_use <= 0:
        return 0
    uc = _ensure_user_credit(db, user_id)
    if uc.balance_clp <= 0:
        return 0
    use = min(amount_to_use, uc.balance_clp)
    uc.balance_clp -= use
    uc.total_spent += use

    tx = CreditTransaction(
        user_id=user_id,
        amount_clp=-use,
        type="appointment_used",
        description="Uso de saldo para cita médica",
        appointment_id=appointment_id,
        balance_after=uc.balance_clp,
    )
    db.add(tx)
    return use
