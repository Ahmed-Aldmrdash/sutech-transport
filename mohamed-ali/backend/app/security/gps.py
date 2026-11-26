"""Authenticate HTTP GPS device updates with signed, timestamped requests."""

import base64
import hashlib
import hmac
import re
import time

GPS_MAX_CLOCK_SKEW_SECONDS = 60
GPS_INGEST_PATH = "/api/v1/gps/ingest"
_NONCE_PATTERN = re.compile(r"^[A-Za-z0-9_-]{16,128}$")


class GPSAuthError(ValueError):
    """A device request failed signature, freshness, or replay validation."""


def _key(secret: str) -> bytes:
    encoded = secret.encode("utf-8")
    if len(encoded) < 32:
        raise ValueError("GPS device secret must be at least 32 bytes")
    return encoded


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _decode_signature(signature: str) -> bytes:
    if not re.fullmatch(r"[A-Za-z0-9_-]{43}", signature):
        raise GPSAuthError("GPS signature format is invalid")
    try:
        decoded = base64.urlsafe_b64decode(signature + "=")
    except Exception as exc:
        raise GPSAuthError("GPS signature format is invalid") from exc
    if _b64url(decoded) != signature:
        raise GPSAuthError("GPS signature format is invalid")
    return decoded


def canonical_gps_message(
    *,
    device_id: str,
    method: str,
    path: str,
    timestamp: str,
    nonce: str,
    body: bytes,
) -> bytes:
    """Build the exact string that both device and server sign."""
    if not device_id or not method or not path.startswith("/") or "?" in path:
        raise ValueError("GPS signature requires device id, method, and a canonical path")
    body_hash = hashlib.sha256(body).hexdigest()
    return "\n".join(
        [device_id, method.upper(), path, timestamp, nonce, body_hash]
    ).encode("utf-8")


def sign_gps_request(
    *,
    device_id: str,
    secret: str,
    method: str,
    path: str,
    timestamp: str,
    nonce: str,
    body: bytes,
) -> str:
    """Helper for device firmware simulators and tests; send requests over HTTPS only."""
    if not _NONCE_PATTERN.fullmatch(nonce):
        raise ValueError("GPS nonce must be 16-128 base64url characters")
    message = canonical_gps_message(
        device_id=device_id,
        method=method,
        path=path,
        timestamp=timestamp,
        nonce=nonce,
        body=body,
    )
    return _b64url(hmac.new(_key(secret), message, hashlib.sha256).digest())


def verify_gps_request(
    *,
    device_id: str,
    secret: str,
    method: str,
    path: str,
    timestamp: str,
    nonce: str,
    signature: str,
    body: bytes,
    now: int | None = None,
    max_clock_skew_seconds: int = GPS_MAX_CLOCK_SKEW_SECONDS,
    nonce_already_used: bool = False,
) -> None:
    """Verify HMAC and freshness. The ingest service must atomically persist nonce use."""
    key = _key(secret)
    if path != GPS_INGEST_PATH or method.upper() != "POST":
        raise GPSAuthError("GPS request target is not allowed")
    if len(body) > 64 * 1024:
        raise GPSAuthError("GPS payload is too large")
    if not _NONCE_PATTERN.fullmatch(nonce):
        raise GPSAuthError("GPS nonce format is invalid")
    try:
        sent_at = int(timestamp)
    except (TypeError, ValueError) as exc:
        raise GPSAuthError("GPS timestamp is invalid") from exc
    current_time = int(time.time() if now is None else now)
    if max_clock_skew_seconds < 1 or max_clock_skew_seconds > 300:
        raise ValueError("GPS clock-skew window must be 1-300 seconds")
    if abs(current_time - sent_at) > max_clock_skew_seconds:
        raise GPSAuthError("GPS request timestamp is outside the allowed window")
    if nonce_already_used:
        raise GPSAuthError("GPS request nonce was already used")

    message = canonical_gps_message(
        device_id=device_id,
        method=method,
        path=path,
        timestamp=timestamp,
        nonce=nonce,
        body=body,
    )
    expected = hmac.new(key, message, hashlib.sha256).digest()
    if not hmac.compare_digest(expected, _decode_signature(signature)):
        raise GPSAuthError("GPS request signature is invalid")
