"""Encripción simétrica at-rest para campos clínicos sensibles.

Diseño:
- Fernet (AES-128-CBC + HMAC-SHA256) — formato robusto, autenticado.
- Key derivada de SECRET_KEY via HKDF-SHA256. Si rotás SECRET_KEY perdés acceso
  a los datos, así que NO la rotes sin re-encriptar (script de migración).
- Para soportar datos legacy (filas existentes en plaintext) el decrypt es
  *tolerante*: si el valor no parece un token Fernet, lo devuelve como string.
  Una vez migrado todo el universo con `encrypt_legacy_rows.py`, podríamos
  endurecer esto.

NO usar para passwords (eso queda con bcrypt en security.py) ni para tokens
JWT (eso usa la SECRET_KEY directo con HS256).
"""
import base64
import logging
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from app.core.config import settings

logger = logging.getLogger(__name__)

# Salt fija para el HKDF. No es secreta — es público que esto es la salt usada
# para derivar la field-encryption-key desde SECRET_KEY. La propiedad de seguridad
# de HKDF no depende de mantener la salt en secreto.
_HKDF_SALT = b"miespejo.cl/field-encryption/v1"
_HKDF_INFO = b"miespejo.cl/clinical-fields-fernet"


def _derive_fernet_key() -> bytes:
    secret = settings.SECRET_KEY.encode("utf-8")
    raw = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=_HKDF_SALT,
        info=_HKDF_INFO,
    ).derive(secret)
    return base64.urlsafe_b64encode(raw)


# Lazy singleton — no derivamos en import time para que los tests puedan
# monkeypatchear settings.SECRET_KEY si lo necesitaran.
_fernet: Optional[Fernet] = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        _fernet = Fernet(_derive_fernet_key())
    return _fernet


def encrypt_str(plaintext: str) -> str:
    """Encripta un string UTF-8 → token Fernet en string ASCII."""
    token = _get_fernet().encrypt(plaintext.encode("utf-8"))
    return token.decode("ascii")


def decrypt_str(token: str) -> str:
    """Desencripta un token Fernet. Si el valor no es un token Fernet
    (datos legacy en plaintext), lo devuelve as-is."""
    if not isinstance(token, str):
        return token
    if not _looks_like_fernet(token):
        return token
    try:
        return _get_fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except InvalidToken:
        # Token con prefijo gAAAA pero no descifrable: pudo cambiar la SECRET_KEY,
        # corrupción, o coincidencia. Lo devolvemos as-is y avisamos al log.
        logger.warning("decrypt_str: token con prefijo Fernet pero InvalidToken — ¿rotó SECRET_KEY?")
        return token


def _looks_like_fernet(s: str) -> bool:
    # Todos los tokens Fernet empiezan con 'gAAAA' (base64 de version byte 0x80 + 4 bytes).
    return s.startswith("gAAAA")
