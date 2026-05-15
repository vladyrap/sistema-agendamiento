"""Servicio de auditoría: registra accesos a recursos clínicos sensibles.

Importante: `log_access` NUNCA debe romper el flujo del endpoint. Si falla
(por ejemplo, la tabla no existe en tests sin migrar), se loguea warning y se sigue.
"""
import logging
from typing import Optional

from fastapi import Request
from sqlalchemy.orm import Session

from app.models.access_audit_log import AccessAuditLog
from app.models.user import User

logger = logging.getLogger(__name__)


# Tipos de recurso. String libre, pero centralizado para evitar typos.
RESOURCE_MEDICAL_RECORD = "MedicalRecord"
RESOURCE_PATIENT_NOTE = "PatientNote"
RESOURCE_ATTACHMENT = "MedicalAttachment"
RESOURCE_SESSION_LOG = "SessionLog"

# Acciones
ACTION_VIEW = "view"
ACTION_LIST = "list"
ACTION_CREATE = "create"
ACTION_UPDATE = "update"
ACTION_DELETE = "delete"
ACTION_DOWNLOAD = "download"


def _client_ip(request: Optional[Request]) -> Optional[str]:
    if request is None:
        return None
    # Detrás del Caddy reverse proxy, la IP real viene en X-Forwarded-For.
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else None


def log_access(
    db: Session,
    user: Optional[User],
    resource_type: str,
    action: str,
    *,
    resource_id: Optional[int] = None,
    patient_id: Optional[int] = None,
    request: Optional[Request] = None,
) -> None:
    """Inserta una fila de auditoría. Silencioso ante errores."""
    try:
        entry = AccessAuditLog(
            user_id=user.id if user else None,
            user_email=user.email if user else None,
            user_role=user.role.value if user and user.role else None,
            resource_type=resource_type,
            resource_id=resource_id,
            patient_id=patient_id,
            action=action,
            ip_address=_client_ip(request),
            user_agent=(request.headers.get("user-agent") if request else None) or None,
        )
        db.add(entry)
        db.commit()
    except Exception as e:
        logger.warning("audit.log_access failed: %s", e)
        try:
            db.rollback()
        except Exception:
            pass
