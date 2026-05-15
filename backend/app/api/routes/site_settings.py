"""Endpoints para configuración global del sitio (mantenedor admin)."""
from datetime import datetime
from typing import Optional, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.site_settings import SiteSettings
from app.api.deps import get_current_user

router = APIRouter(tags=["Site Settings"])


# ── Schemas ────────────────────────────────────────────────────────────────

class SettingsPublic(BaseModel):
    """Campos visibles públicamente — NO incluye `notes` ni `extra` (pueden tener data interna)."""
    whatsapp_number: str
    contact_email: str
    contact_phone_display: str
    business_hours: str


class SettingsAdmin(SettingsPublic):
    notes: Optional[str] = ""
    extra: Optional[dict[str, Any]] = None
    updated_at: Optional[datetime] = None


class SettingsUpdate(BaseModel):
    whatsapp_number: Optional[str] = Field(default=None, max_length=30)
    contact_email:   Optional[str] = Field(default=None, max_length=255)
    contact_phone_display: Optional[str] = Field(default=None, max_length=50)
    business_hours:  Optional[str] = Field(default=None, max_length=120)
    notes:           Optional[str] = None
    extra:           Optional[dict[str, Any]] = None


# ── Helpers ────────────────────────────────────────────────────────────────

DEFAULTS = {
    "whatsapp_number": "",
    "contact_email": "hola@miespejo.cl",
    "contact_phone_display": "",
    "business_hours": "Lun a Vie · 9:00 a 19:00",
    "notes": "",
}


def _get_or_create(db: Session) -> SiteSettings:
    row = db.query(SiteSettings).filter(SiteSettings.id == 1).first()
    if not row:
        row = SiteSettings(id=1, **DEFAULTS)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/site-settings/public", response_model=SettingsPublic)
def get_public_settings(db: Session = Depends(get_db)):
    """Endpoint público: solo campos seguros para mostrar a visitantes."""
    s = _get_or_create(db)
    return SettingsPublic(
        whatsapp_number=s.whatsapp_number or "",
        contact_email=s.contact_email or "",
        contact_phone_display=s.contact_phone_display or "",
        business_hours=s.business_hours or "",
    )


@router.get("/admin/site-settings", response_model=SettingsAdmin)
def get_admin_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Solo admin")
    s = _get_or_create(db)
    return SettingsAdmin(
        whatsapp_number=s.whatsapp_number or "",
        contact_email=s.contact_email or "",
        contact_phone_display=s.contact_phone_display or "",
        business_hours=s.business_hours or "",
        notes=s.notes or "",
        extra=s.extra,
        updated_at=s.updated_at,
    )


@router.put("/admin/site-settings", response_model=SettingsAdmin)
def update_admin_settings(
    data: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Solo admin")

    s = _get_or_create(db)

    # Normalizar el número de WhatsApp: quitar +, espacios, guiones, paréntesis
    if data.whatsapp_number is not None:
        cleaned = "".join(ch for ch in data.whatsapp_number if ch.isdigit())
        s.whatsapp_number = cleaned
    if data.contact_email is not None:
        s.contact_email = data.contact_email.strip()
    if data.contact_phone_display is not None:
        s.contact_phone_display = data.contact_phone_display.strip()
    if data.business_hours is not None:
        s.business_hours = data.business_hours.strip()
    if data.notes is not None:
        s.notes = data.notes
    if data.extra is not None:
        s.extra = data.extra

    db.commit()
    db.refresh(s)
    return SettingsAdmin(
        whatsapp_number=s.whatsapp_number or "",
        contact_email=s.contact_email or "",
        contact_phone_display=s.contact_phone_display or "",
        business_hours=s.business_hours or "",
        notes=s.notes or "",
        extra=s.extra,
        updated_at=s.updated_at,
    )
