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


def rate_limit_check(bucket_key: str, max_hits: int, window_seconds: int) -> tuple[bool, int]:
    """Sliding-window simple via Redis INCR + EXPIRE.

    Devuelve (allowed, current_count). Si current_count <= max_hits, allowed=True.

    No es estrictamente sliding-window (es fixed-window INCR), suficiente para anti-abuso
    en endpoints públicos. Si la primera escritura del bucket, fija el TTL.
    """
    try:
        client = get_redis()
        pipe = client.pipeline()
        pipe.incr(bucket_key)
        pipe.expire(bucket_key, window_seconds, nx=True)  # nx=True: solo si no tiene TTL
        results = pipe.execute()
        count = int(results[0]) if results else 0
        return (count <= max_hits, count)
    except Exception:
        # Si Redis cae, dejamos pasar (mejor disponibilidad que blindaje perfecto)
        return (True, 0)
