import redis
import json
from typing import Optional, Any
from .config import settings

_redis_client: Optional[redis.Redis] = None


def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_client


def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    client = get_redis()
    client.setex(key, ttl, json.dumps(value, default=str))


def cache_get(key: str) -> Optional[Any]:
    client = get_redis()
    data = client.get(key)
    return json.loads(data) if data else None


def cache_delete(key: str) -> None:
    client = get_redis()
    client.delete(key)


def cache_delete_pattern(pattern: str) -> None:
    client = get_redis()
    keys = client.keys(pattern)
    if keys:
        client.delete(*keys)
