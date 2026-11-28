"""Short-lived, server-signed QR tokens for transport passes."""

import base64
import hashlib
import hmac
import json
import re
import secrets
import time
from typing import Any

QR_TOKEN_TTL_SECONDS = 30
QR_TOKEN_PREFIX = "SUT1"


class QRTokenError(ValueError):
    """An invalid, expired, or malformed transport QR token."""


def _require_secret(secret: str) -> bytes:
    key = secret.encode("utf-8")
    if len(key) < 32:
        raise ValueError("QR signing secret must be at least 32 bytes")
    return key


def _encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _decode(value: str) -> bytes:
    try:
        if not value or not re.fullmatch(r"[A-Za-z0-9_-]+", value):
            raise ValueError("not canonical base64url")
        decoded = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
        if _encode(decoded) != value:
            raise ValueError("not canonical base64url")
        return decoded
    except Exception as exc:
        raise QRTokenError("QR token encoding is invalid") from exc


def issue_qr_token(
    *,
    subscription_id: str,
    student_id: str,
    line_id: str,
    secret: str,
    now: int | None = None,
) -> tuple[str, int]:
    """Return `(token, expires_at)`; callers must verify the subscription is active first."""
    key = _require_secret(secret)
    if not subscription_id or not student_id or not line_id:
        raise ValueError("subscription_id, student_id, and line_id are required")
    issued_at = int(time.time() if now is None else now)
    claims = {
        "v": 1,
        "sub": subscription_id,
        "student_id": student_id,
        "line_id": line_id,
        "iat": issued_at,
        "exp": issued_at + QR_TOKEN_TTL_SECONDS,
        "jti": _encode(secrets.token_bytes(16)),
    }
    payload = _encode(json.dumps(claims, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    signed = f"{QR_TOKEN_PREFIX}.{payload}".encode("ascii")
    signature = _encode(hmac.new(key, signed, hashlib.sha256).digest())
    return f"{QR_TOKEN_PREFIX}.{payload}.{signature}", claims["exp"]


def verify_qr_token(
    token: str,
    *,
    secret: str,
    now: int | None = None,
) -> dict[str, Any]:
    """Verify signature and 30-second lifetime; business checks happen in the scan service."""
    key = _require_secret(secret)
    if len(token) > 2048:
        raise QRTokenError("QR token is too large")
    try:
        prefix, payload, supplied_signature = token.split(".")
    except ValueError as exc:
        raise QRTokenError("QR token format is invalid") from exc
    if prefix != QR_TOKEN_PREFIX:
        raise QRTokenError("QR token version is not supported")
    expected = hmac.new(key, f"{prefix}.{payload}".encode("ascii"), hashlib.sha256).digest()
    if not hmac.compare_digest(expected, _decode(supplied_signature)):
        raise QRTokenError("QR token signature is invalid")
    try:
        claims = json.loads(_decode(payload))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise QRTokenError("QR token payload is invalid") from exc
    if not isinstance(claims, dict) or claims.get("v") != 1:
        raise QRTokenError("QR token claims are invalid")
    issued_at = claims.get("iat")
    expires_at = claims.get("exp")
    if not isinstance(issued_at, int) or not isinstance(expires_at, int):
        raise QRTokenError("QR token time claims are invalid")
    current_time = int(time.time() if now is None else now)
    if issued_at > current_time or expires_at <= current_time:
        raise QRTokenError("QR token has expired or is not active yet")
    if expires_at - issued_at != QR_TOKEN_TTL_SECONDS:
        raise QRTokenError("QR token lifetime is invalid")
    for claim in ("sub", "student_id", "line_id", "jti"):
        if not isinstance(claims.get(claim), str) or not claims[claim]:
            raise QRTokenError(f"QR token {claim} claim is invalid")
    return claims
