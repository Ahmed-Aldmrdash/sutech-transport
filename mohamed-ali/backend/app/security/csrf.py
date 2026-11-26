"""Origin checks for browser requests authenticated by the session cookie."""

from urllib.parse import urlsplit


class CSRFError(ValueError):
    """The request did not originate from an approved browser origin."""


def _origin_of(value: str | None) -> str | None:
    if not value or value == "null":
        return None
    try:
        parts = urlsplit(value)
        if parts.scheme not in {"http", "https"} or not parts.hostname:
            return None
        if parts.username or parts.password:
            return None
        port = parts.port
    except ValueError:
        return None
    host = parts.hostname.lower()
    default_port = 443 if parts.scheme == "https" else 80
    authority = host if port in {None, default_port} else f"{host}:{port}"
    return f"{parts.scheme}://{authority}"


def validate_browser_origin(
    *,
    origin: str | None,
    referer: str | None,
    allowed_origins: list[str],
    request_origin: str | None = None,
) -> str:
    """Require Origin (or Referer fallback) to exactly match the app or API origin."""
    supplied = _origin_of(origin) or _origin_of(referer)
    allowed = {
        normalized
        for value in [*allowed_origins, request_origin]
        if (normalized := _origin_of(value)) is not None
    }
    if supplied is None or supplied not in allowed:
        raise CSRFError("Request origin is not allowed")
    return supplied
