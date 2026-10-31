"""TraceBack AI - Security and Request Context Helpers
"""
import time
import uuid
import re
from typing import Dict, Tuple
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from backend.app.core.exceptions import RateLimitExceededError


# In-memory sliding window rate limiter: (client_ip, endpoint_prefix) -> list of timestamps
_RATE_LIMIT_STORE: Dict[str, list[float]] = {}
_MAX_REQUESTS_PER_MINUTE = 120
_COPILOT_MAX_REQUESTS_PER_MINUTE = 30


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Injects a unique request_id into state and response headers."""
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id

        # Basic rate limiting
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path

        # Rate limit API calls only; static frontend files are not throttled
        if path.startswith("/api/") and not _check_rate_limit(client_ip, path):
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded",
                    "message": "Too many requests. Please slow down.",
                    "request_id": request_id
                },
                headers={"X-Request-ID": request_id, "Retry-After": "60"}
            )

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


def _check_rate_limit(client_ip: str, path: str) -> bool:
    now = time.time()
    limit = _COPILOT_MAX_REQUESTS_PER_MINUTE if "/copilot" in path else _MAX_REQUESTS_PER_MINUTE
    key = f"{client_ip}:{path.split('/')[3] if len(path.split('/')) > 3 else 'root'}"

    timestamps = _RATE_LIMIT_STORE.get(key, [])
    # Filter out entries older than 60 seconds
    valid_timestamps = [ts for ts in timestamps if now - ts < 60.0]

    if len(valid_timestamps) >= limit:
        _RATE_LIMIT_STORE[key] = valid_timestamps
        return False

    valid_timestamps.append(now)
    _RATE_LIMIT_STORE[key] = valid_timestamps
    return True


def sanitize_input_text(text: str) -> str:
    """Strips dangerous control characters and trims input string."""
    if not text:
        return ""
    # Strip null bytes and non-printable control characters except standard whitespace
    cleaned = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", text)
    return cleaned.strip()
