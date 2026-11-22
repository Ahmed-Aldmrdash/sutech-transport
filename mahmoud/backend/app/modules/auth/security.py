"""Cryptographic helpers for OTPs and opaque session cookies."""

import hashlib
import hmac
import secrets


def generate_otp() -> str:
    """Return a cryptographically secure four-digit code (including leading zeroes)."""
    return f"{secrets.randbelow(10_000):04d}"


def hash_otp(identifier: str, code: str, secret: str) -> str:
    """Create a keyed hash so a database leak does not expose short OTP values."""
    if not secret:
        raise ValueError("SUTECH_OTP_SECRET must be configured")
    message = f"{identifier}:{code}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def verify_otp(identifier: str, code: str, stored_hash: str, secret: str) -> bool:
    if not stored_hash or not secret:
        return False
    return hmac.compare_digest(hash_otp(identifier, code, secret), stored_hash)


def generate_session_token() -> str:
    """Return a high-entropy token suitable for an HttpOnly cookie."""
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def mask_phone(phone: str) -> str:
    if len(phone) <= 5:
        return "•" * len(phone)
    return f"{phone[:3]}•••••{phone[-3:]}"
