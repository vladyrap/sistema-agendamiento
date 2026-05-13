"""Endpoint público del asistente conversacional (Calmar bot)."""
from __future__ import annotations
import logging
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services import chat_agent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["Chat"])


# ─── Rate limit en memoria (por IP, ventana de 60s) ────────────────────────
# No queremos depender de Redis para esto: si el contenedor reinicia, los
# contadores se resetean — está bien.
_RATE: dict[str, list[float]] = {}
_RATE_LIMIT = 30  # mensajes
_RATE_WINDOW = 60.0  # segundos


def _check_rate(ip: str) -> bool:
    now = time.time()
    arr = _RATE.setdefault(ip, [])
    cutoff = now - _RATE_WINDOW
    arr[:] = [t for t in arr if t >= cutoff]
    if len(arr) >= _RATE_LIMIT:
        return False
    arr.append(now)
    return True


class ChatTurn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    text: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: Optional[list[ChatTurn]] = None


class ChatResponse(BaseModel):
    reply: str
    crisis: bool = False


@router.get("/status")
def chat_status():
    """Permite al frontend saber si el chat está habilitado en este deploy."""
    return {"enabled": chat_agent.is_enabled()}


@router.post("/message", response_model=ChatResponse)
def post_message(
    payload: ChatRequest, request: Request, db: Session = Depends(get_db)
):
    ip = (request.client.host if request.client else None) or "unknown"
    if not _check_rate(ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados mensajes. Espera un momento e intenta de nuevo.",
        )

    history = [t.model_dump() for t in (payload.history or [])]
    try:
        result = chat_agent.chat(db, payload.message, history=history)
    except Exception:
        logger.exception("chat.unhandled_error")
        return ChatResponse(
            reply="Tuve un problema procesando tu mensaje. ¿Puedes intentarlo de nuevo?",
            crisis=False,
        )
    return ChatResponse(reply=result["reply"], crisis=bool(result.get("crisis")))
