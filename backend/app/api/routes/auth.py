from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.user import User
from app.models.user import UserRole
from app.schemas.user import UserCreate, UserResponse, UserUpdate, Token, LoginRequest
from app.api.deps import get_current_user, rate_limit
from app.services.notifications import enqueue

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
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return Token(access_token=token, user=user)


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
