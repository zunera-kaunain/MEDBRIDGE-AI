"""Simple in-memory rate limiting for the sign-in and password endpoints.

Each key (an IP address, or an email) may make `limit` attempts per
`window` seconds. Past that the API answers 429 with a Retry-After header.

Honest limits of this approach: counts live in this process's memory, so
they reset when the server restarts and are not shared between several
server processes. That is fine for a single-clinic deployment; a bigger
one would move the counters to Redis.
"""

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

_hits: dict[str, deque[float]] = defaultdict(deque)


def check_rate_limit(key: str, limit: int, window: int) -> None:
    now = time.monotonic()
    hits = _hits[key]
    while hits and now - hits[0] > window:
        hits.popleft()

    if len(hits) >= limit:
        retry_after = max(1, int(window - (now - hits[0])))
        raise HTTPException(
            status_code=429,
            detail=f"Too many attempts. Try again in {_human(retry_after)}.",
            headers={"Retry-After": str(retry_after)},
        )

    hits.append(now)

    # Keep memory bounded: forget keys that have gone quiet.
    if len(_hits) > 10_000:
        for k in [k for k, v in _hits.items() if not v or now - v[-1] > window]:
            _hits.pop(k, None)


def _human(seconds: int) -> str:
    if seconds < 60:
        return f"{seconds} seconds"
    minutes = (seconds + 59) // 60
    return f"{minutes} minute{'s' if minutes != 1 else ''}"


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def rate_limit(name: str, limit: int, window: int):
    """FastAPI dependency: limit an endpoint per client IP.

    Usage: @router.post("/login", dependencies=[Depends(rate_limit("login", 10, 60))])
    """

    def dependency(request: Request) -> None:
        check_rate_limit(f"{name}:ip:{client_ip(request)}", limit, window)

    return dependency
