import base64
import io
from datetime import datetime
from urllib.parse import quote

import pyotp
import qrcode
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    block_token,
    create_access_token,
    get_password_hash,
    verify_password,
)
from app.models.user import User, UserRole
from app.schemas.user import (
    LoginRequest,
    Token,
    TotpCodeRequest,
    TotpSetupResponse,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from app.api.deps import get_current_token_payload, get_current_user, rate_limit
from app.services.notifications import enqueue

TOTP_ISSUER = "miespejo.cl"

router = APIRouter(prefix="/auth", tags=["Autenticación"])

# Anti-abuso: 5 logins/min y 3 registros/5min por IP. Si cae Redis, fail-open (ver rate_limit_check).
_login_limit = rate_limit("login", max_hits=5, window_seconds=60)
_register_limit = rate_limit("register", max_hits=3, window_seconds=300)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(_register_limit)])
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    if user_data.rut and db.query(User).filter(User.rut == user_data.rut).first():
        raise HTTPException(status_code=400, detail="El RUT ya está registrado")

    # Solo permitimos auto-registro como paciente o tutor. Doctores y admins se crean
    # internamente desde el panel admin (no self-service).
    requested_role = user_data.role or UserRole.patient
    if requested_role not in (UserRole.patient, UserRole.tutor):
        raise HTTPException(status_code=400, detail="Rol no permitido para registro público")

    user = User(
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        phone=user_data.phone,
        rut=user_data.rut,
        role=requested_role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Si se registra como tutor, vincular automáticamente cualquier TutorRelationship
    # pendiente que use su email.
    if user.role == UserRole.tutor:
        from app.models.tutor import TutorRelationship
        pending = db.query(TutorRelationship).filter(
            TutorRelationship.email == user.email.lower(),
            TutorRelationship.tutor_user_id == None,  # noqa: E711
        ).all()
        for rel in pending:
            rel.tutor_user_id = user.id
        if pending:
            db.commit()

    # Avisar a admins del nuevo registro
    admins = db.query(User).filter(User.role == UserRole.admin, User.is_active == True).all()
    for admin in admins:
        enqueue("user_registered", {
            "recipient_role": "admin",
            "to_email": admin.email,
            "to_phone": admin.phone,
            "to_name": f"{admin.first_name} {admin.last_name}",
            "new_user_name": f"{user.first_name} {user.last_name}",
            "new_user_email": user.email,
            "new_user_rut": user.rut or "",
            "new_user_role": user.role.value,
        })

    return user


@router.post("/login", response_model=Token, dependencies=[Depends(_login_limit)])
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cuenta desactivada")

    # Si el usuario tiene 2FA activo, exigimos código TOTP en este mismo request.
    # El frontend debe re-enviar el login con `totp_code` cuando recibe 401 totp_required.
    if user.totp_enabled and user.totp_secret:
        if not credentials.totp_code:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="totp_required",
            )
        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(credentials.totp_code, valid_window=1):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Código TOTP inválido",
            )

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return Token(access_token=token, user=user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(payload: dict = Depends(get_current_token_payload)):
    """Revoca el JWT actual hasta su expiración natural."""
    jti = payload.get("jti")
    exp = payload.get("exp")
    if jti and exp:
        ttl = int(exp - datetime.utcnow().timestamp())
        block_token(jti, ttl)
    return None


# ─── 2FA TOTP ──────────────────────────────────────────────────────────────

@router.post("/2fa/setup", response_model=TotpSetupResponse)
def totp_setup(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Genera un secret TOTP nuevo (no lo activa aún). El frontend muestra QR;
    el usuario confirma con `/auth/2fa/verify` antes de que quede operativo.

    Llamar de nuevo mientras está pendiente regenera el secret.
    """
    secret = pyotp.random_base32()
    current_user.totp_secret = secret
    current_user.totp_enabled = False
    db.commit()

    label = quote(f"{TOTP_ISSUER}:{current_user.email}", safe=":@")
    otpauth_url = (
        f"otpauth://totp/{label}?secret={secret}&issuer={quote(TOTP_ISSUER)}&algorithm=SHA1&digits=6&period=30"
    )

    # Generamos el QR server-side para que el secret nunca salga del backend del cliente.
    qr_img = qrcode.make(otpauth_url, box_size=6, border=2)
    buf = io.BytesIO()
    qr_img.save(buf, format="PNG")
    qr_data_url = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")

    return TotpSetupResponse(secret=secret, otpauth_url=otpauth_url, qr_data_url=qr_data_url)


@router.post("/2fa/verify", response_model=UserResponse)
def totp_verify(
    data: TotpCodeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Confirma el código TOTP y activa 2FA permanentemente."""
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="No hay setup pendiente — llamá primero a /2fa/setup")
    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Código TOTP inválido")
    current_user.totp_enabled = True
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/2fa/disable", response_model=UserResponse)
def totp_disable(
    data: TotpCodeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Desactiva 2FA. Requiere el código TOTP actual como protección — no basta con
    estar logueado, porque si te robaron la sesión podrían apagarlo."""
    if not (current_user.totp_enabled and current_user.totp_secret):
        raise HTTPException(status_code=400, detail="2FA no está activo")
    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Código TOTP inválido")
    current_user.totp_enabled = False
    current_user.totp_secret = None
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_me(
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permite al usuario actualizar sus propios datos personales."""
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(current_user, key, value)
    db.commit()
    db.refresh(current_user)
    return current_user
