"""Site-wide settings editables por admin desde el mantenedor.

Diseño: una sola fila (id=1). Si la fila no existe al primer get, se crea con
defaults. La columna `extra` (JSON) permite agregar campos nuevos sin migraciones.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from app.core.database import Base


class SiteSettings(Base):
    __tablename__ = "site_settings"

    id              = Column(Integer, primary_key=True)
    whatsapp_number = Column(String(30), default="", nullable=False)
    contact_email   = Column(String(255), default="", nullable=False)
    contact_phone_display = Column(String(50), default="", nullable=False)  # versión humana, ej: "+56 9 1234 5678"
    business_hours  = Column(String(120), default="", nullable=False)  # ej: "Lun a Vie · 9-19h"
    notes           = Column(Text, default="")
    extra           = Column(JSON, nullable=True)  # para extender sin migrar
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
