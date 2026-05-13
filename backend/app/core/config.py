from __future__ import annotations
from pydantic_settings import BaseSettings
from typing import Optional, List


class Settings(BaseSettings):
    PROJECT_NAME: str = "Sistema de Agendamiento Clínico"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"

    SECRET_KEY: str = "change-me-in-production-use-a-long-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "agendamiento"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 6502

    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6503
    REDIS_DB: int = 0

    CORS_ORIGINS: List[str] = ["http://localhost:6500"]

    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 25
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: str = "noreply@agendamiento.local"
    SMTP_USE_TLS: bool = False

    LOGSTASH_HOST: Optional[str] = None
    LOGSTASH_PORT: int = 5000
    LOG_LEVEL: str = "INFO"

    # URL pública de la app — se usa para back_urls de MercadoPago.
    APP_PUBLIC_URL: str = "http://localhost:6500"

    # MercadoPago — vacío = pagos deshabilitados (las citas no piden pago).
    MP_ACCESS_TOKEN: Optional[str] = None
    MP_PUBLIC_KEY: Optional[str] = None
    MP_WEBHOOK_SECRET: Optional[str] = None
    MP_CURRENCY: str = "CLP"

    # Twilio SMS — vacío = log-only.
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_FROM_NUMBER: Optional[str] = None

    # Gemini (Google AI Studio) — vacío = chat agente deshabilitado.
    GEMINI_API_KEY: Optional[str] = None

    # Adjuntos de ficha clínica
    UPLOAD_DIR: str = "/app/uploads"
    UPLOAD_MAX_BYTES: int = 20 * 1024 * 1024  # 20 MB

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def REDIS_URL(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
