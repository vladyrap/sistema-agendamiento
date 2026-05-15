import secrets
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from .config import settings
from .redis_client import get_redis

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Prefijo de claves Redis para JWT revocados.
JWT_BLOCKLIST_PREFIX = "jwt:blocked:"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Genera un JWT con `jti` (JWT ID) random para poder revocarlo en blocklist."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "jti": secrets.token_urlsafe(16)})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """Decode + valida que el `jti` no esté en la blocklist Redis."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
    jti = payload.get("jti")
    if jti and _is_token_blocked(jti):
        return None
    return payload


def _is_token_blocked(jti: str) -> bool:
    try:
        return bool(get_redis().exists(f"{JWT_BLOCKLIST_PREFIX}{jti}"))
    except Exception:
        # Si Redis cae, no podemos verificar — fail-open para no romper auth.
        return False


def block_token(jti: str, ttl_seconds: int) -> None:
    """Mete el jti en la blocklist con TTL = tiempo restante hasta expiración."""
    if not jti or ttl_seconds <= 0:
        return
    try:
        get_redis().setex(f"{JWT_BLOCKLIST_PREFIX}{jti}", ttl_seconds, "1")
    except Exception:
        pass
