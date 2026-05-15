"""Tipos custom de SQLAlchemy para los modelos."""
from typing import Optional

from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator

from app.core.encryption import decrypt_str, encrypt_str


class EncryptedText(TypeDecorator):
    """Text en DB, pero encriptado at-rest con Fernet derivado de SECRET_KEY.

    Uso:
        from app.models._types import EncryptedText
        content = Column(EncryptedText)

    - Si el valor entrante es None, se guarda NULL.
    - Si el valor leído de la DB no parece un token Fernet (datos legacy en
      plaintext), se devuelve como vino — no se intenta descifrar.
    - Al guardar, siempre se encripta. Las filas legacy quedan encriptadas
      en su próximo UPDATE.

    No hereda `cache_ok = True` por defecto: lo declaramos True porque
    nuestra transformación bind/result no depende del statement.
    """

    impl = Text
    cache_ok = True

    def process_bind_param(self, value: Optional[str], dialect) -> Optional[str]:
        if value is None:
            return None
        if not isinstance(value, str):
            value = str(value)
        return encrypt_str(value)

    def process_result_value(self, value: Optional[str], dialect) -> Optional[str]:
        if value is None:
            return None
        return decrypt_str(value)
