from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado")
    user = db.query(User).filter(User.id == payload.get("sub")).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")
    return user


def require_role(*roles: UserRole):
    def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin permisos suficientes")
        return current_user
    return checker


require_admin        = require_role(UserRole.admin)
require_doctor       = require_role(UserRole.doctor, UserRole.admin)
require_patient      = require_role(UserRole.patient, UserRole.admin)
require_receptionist = require_role(UserRole.receptionist, UserRole.admin)
# Staff = personal interno (admin + recepcionista). Pueden agendar a nombre del paciente,
# buscar pacientes, ver todas las agendas. NO pueden gestionar configuración del sistema.
require_staff        = require_role(UserRole.receptionist, UserRole.admin)
