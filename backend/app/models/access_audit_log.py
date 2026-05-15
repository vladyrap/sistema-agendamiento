"""Log inmutable de accesos a recursos clínicos sensibles.

Registra quién leyó/editó/descargó/eliminó qué ficha, nota o adjunto.
Sirve para auditoría ante reclamos, brechas o requerimientos legales (Ley 19.628 / 21.719).

Diseño:
- Append-only desde la app (sin endpoints de update/delete).
- Guarda snapshot del user (email, role) por si la cuenta se borra después.
- `resource_type` es string libre para no acoplar a una enum que crece.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Index
from app.core.database import Base


class AccessAuditLog(Base):
    __tablename__ = "access_audit_logs"
    __table_args__ = (
        Index("ix_audit_patient_created", "patient_id", "created_at"),
        Index("ix_audit_user_created", "user_id", "created_at"),
        Index("ix_audit_resource", "resource_type", "resource_id"),
    )

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, index=True, nullable=True)
    user_email = Column(String(255), nullable=True)
    user_role = Column(String(30), nullable=True)

    resource_type = Column(String(50), nullable=False)
    resource_id = Column(Integer, nullable=True)
    patient_id = Column(Integer, index=True, nullable=True)

    action = Column(String(20), nullable=False)

    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
