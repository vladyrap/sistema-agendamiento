"""Structured JSON logging with optional Logstash TCP forwarding."""
import json
import logging
import socket
import threading
from datetime import datetime
from typing import Optional
from pythonjsonlogger import jsonlogger
from .config import settings


class LogstashTCPHandler(logging.Handler):
    """Lightweight non-blocking TCP handler for Logstash json_lines input.

    Drops messages on transient failures rather than blocking the request path.
    Reconnects lazily on the next emit.
    """

    def __init__(self, host: str, port: int, timeout: float = 2.0):
        super().__init__()
        self.host = host
        self.port = port
        self.timeout = timeout
        self.sock: Optional[socket.socket] = None
        self._lock = threading.Lock()

    def _connect(self) -> None:
        if self.sock is None:
            self.sock = socket.create_connection((self.host, self.port), timeout=self.timeout)

    def emit(self, record: logging.LogRecord) -> None:
        try:
            payload = {
                "@timestamp": datetime.utcfromtimestamp(record.created).isoformat() + "Z",
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
                "service": settings.PROJECT_NAME,
            }
            if record.exc_info:
                payload["exception"] = self.format(record)
            data = (json.dumps(payload, default=str) + "\n").encode("utf-8")
            with self._lock:
                self._connect()
                self.sock.sendall(data)
        except Exception:
            with self._lock:
                if self.sock is not None:
                    try:
                        self.sock.close()
                    except Exception:
                        pass
                    self.sock = None


def setup_logging() -> None:
    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(settings.LOG_LEVEL)

    stdout_handler = logging.StreamHandler()
    stdout_handler.setFormatter(
        jsonlogger.JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    )
    root.addHandler(stdout_handler)

    if settings.LOGSTASH_HOST:
        try:
            ls_handler = LogstashTCPHandler(settings.LOGSTASH_HOST, settings.LOGSTASH_PORT)
            ls_handler.setLevel(settings.LOG_LEVEL)
            root.addHandler(ls_handler)
        except Exception as e:
            logging.getLogger(__name__).warning("Logstash handler init failed: %s", e)

    for noisy in ("uvicorn.access", "sqlalchemy.engine"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
