"""Notification dispatch: enqueue events on Redis, processed by app/worker.py."""
import json
import logging
from typing import Any, Dict
from app.core.redis_client import get_redis
from app.core.metrics import notifications_enqueued

QUEUE_KEY = "notifications:queue"
logger = logging.getLogger(__name__)


def enqueue(event_type: str, payload: Dict[str, Any]) -> None:
    """Push a notification event onto the Redis queue.

    Failures are logged but never raised — notifications must not break the
    user-facing request.
    """
    try:
        message = json.dumps({"type": event_type, "payload": payload}, default=str)
        get_redis().lpush(QUEUE_KEY, message)
        notifications_enqueued.labels(type=event_type).inc()
        logger.info("notification.enqueued", extra={"event_type": event_type})
    except Exception:
        logger.exception("notification.enqueue_failed", extra={"event_type": event_type})
