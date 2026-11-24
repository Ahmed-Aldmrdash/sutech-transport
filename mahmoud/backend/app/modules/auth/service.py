"""OTP sign-in, opaque sessions, and account lookup."""

import asyncio
import json
import os
from datetime import UTC, datetime, timedelta
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.auth.models import Account, AuthSession, OTP
from app.modules.auth.security import (
    generate_otp,
    generate_session_token,
    hash_otp,
    hash_session_token,
    mask_phone,
    verify_otp,
)

OTP_LENGTH = 4
OTP_TTL = timedelta(minutes=5)
OTP_RESEND_WAIT = timedelta(seconds=60)
OTP_LOCK_TIME = timedelta(minutes=15)
OTP_ATTEMPTS = 3
SESSION_COOKIE = "sut_session"
LONG_SESSION_ROLES = {"student", "parent", "driver", "supervisor"}
ALL_ROLES = {
    "super_admin", "transport_admin", "finance", "clinic", "student_affairs",
    "secretary_general", "bus_company", "driver", "supervisor", "student", "parent",
}


def utcnow() -> datetime:
    return datetime.now(UTC)


def as_utc(value: datetime) -> datetime:
    """SQLite returns naive datetimes even for timezone-enabled columns."""
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def normalize_identifier(identifier: str) -> str:
    return identifier.strip().casefold()


def _otp_secret() -> str:
    configured = os.getenv("SUTECH_OTP_SECRET", "")
    if configured:
        return configured
    if settings.environment in {"development", "test"}:
        return "local-only-change-this-secret-before-deployment"
    raise HTTPException(status_code=503, detail={"code": "AUTH_NOT_CONFIGURED", "message": "Authentication is not configured"})


async def _post_sms(url: str, token: str, phone: str, message: str) -> None:
    """Send through the project's SMS gateway webhook contract."""
    body = json.dumps({"to": phone, "message": message}).encode("utf-8")
    request = Request(
        url,
        data=body,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )

    class _RejectRedirects(HTTPRedirectHandler):
        """Do not forward the bearer token to a redirect target."""

        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    def send() -> None:
        with build_opener(_RejectRedirects).open(request, timeout=8) as response:
            if not 200 <= response.status < 300:
                raise RuntimeError("SMS gateway rejected the message")

    await asyncio.to_thread(send)


async def deliver_otp(phone: str, code: str) -> str | None:
    """Return a demo code only in development/test; production requires an SMS gateway."""
    if settings.environment in {"development", "test"}:
        return code
    url = os.getenv("SUTECH_SMS_GATEWAY_URL", "")
    token = os.getenv("SUTECH_SMS_GATEWAY_TOKEN", "")
    parsed_url = urlparse(url)
    if parsed_url.scheme != "https" or not parsed_url.netloc or not token:
        raise HTTPException(status_code=503, detail={"code": "SMS_NOT_CONFIGURED", "message": "SMS delivery is not configured"})
    try:
        await _post_sms(url, token, phone, f"Your SUtech Transport verification code is {code}.")
    except Exception as exc:
        raise HTTPException(status_code=502, detail={"code": "SMS_DELIVERY_FAILED", "message": "Could not deliver the verification code"}) from exc
    return None


def account_user(account: Account) -> dict[str, object]:
    return {
        "id": str(account.id),
        "role": account.role,
        "name": account.name,
        "name_ar": account.name_ar,
        "identifier": account.identifier,
        "faculty": account.faculty,
        "faculty_ar": account.faculty_ar,
        "level": account.level,
        "guardian_name": account.guardian_name,
        "guardian_name_ar": account.guardian_name_ar,
        "masked_phone": mask_phone(account.phone),
        "phone": account.phone,
    }


async def request_otp(session: AsyncSession, identifier: str, language: str = "en") -> dict[str, object]:
    now = utcnow()
    key = normalize_identifier(identifier)
    account = await session.scalar(
        select(Account).where(Account.identifier_key == key).with_for_update()
    )
    if account is None:
        raise HTTPException(status_code=404, detail={"code": "UNKNOWN_IDENTIFIER", "message": "No account matches this identifier"})
    if not account.is_active:
        raise HTTPException(status_code=403, detail={"code": "ACCOUNT_DISABLED", "message": "This account is disabled"})

    challenge = await session.scalar(
        select(OTP).where(OTP.account_id == str(account.id)).with_for_update()
    )
    if challenge and challenge.locked_until and as_utc(challenge.locked_until) > now:
        raise HTTPException(status_code=429, detail={"code": "OTP_LOCKED", "message": "Too many incorrect codes; try again later"})
    if challenge and now - as_utc(challenge.sent_at) < OTP_RESEND_WAIT:
        raise HTTPException(status_code=429, detail={"code": "OTP_RATE_LIMITED", "message": "Wait before requesting another code"})

    code = generate_otp()
    secret = _otp_secret()
    if challenge is None:
        challenge = OTP(
            account_id=str(account.id),
            code_hash=hash_otp(key, code, secret),
            expires_at=now + OTP_TTL,
            sent_at=now,
            attempts_left=OTP_ATTEMPTS,
        )
        session.add(challenge)
    else:
        challenge.code_hash = hash_otp(key, code, secret)
        challenge.expires_at = now + OTP_TTL
        challenge.sent_at = now
        challenge.attempts_left = OTP_ATTEMPTS
        challenge.locked_until = None

    demo_code = await deliver_otp(account.phone, code)
    await session.commit()
    display_name = account.name_ar if language.lower().startswith("ar") and account.name_ar else account.name
    return {
        "masked_destination": mask_phone(account.phone),
        "name_hint": display_name.split()[0] if display_name else "",
        "expires_in_seconds": int(OTP_TTL.total_seconds()),
        "attempts_left": OTP_ATTEMPTS,
        "code_length": OTP_LENGTH,
        "resend_after_seconds": int(OTP_RESEND_WAIT.total_seconds()),
        **({"demo_code": demo_code} if demo_code else {}),
    }


def _session_lifetime(role: str) -> timedelta:
    if role not in ALL_ROLES:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Account role is not supported"})
    return timedelta(days=30) if role in LONG_SESSION_ROLES else timedelta(hours=12)


async def login(session: AsyncSession, identifier: str, code: str) -> tuple[dict[str, object], str, datetime]:
    now = utcnow()
    key = normalize_identifier(identifier)
    account = await session.scalar(
        select(Account).where(Account.identifier_key == key).with_for_update()
    )
    challenge = None
    if account:
        challenge = await session.scalar(
            select(OTP).where(OTP.account_id == str(account.id)).with_for_update()
        )
    if challenge and challenge.locked_until and as_utc(challenge.locked_until) > now:
        raise HTTPException(status_code=429, detail={"code": "OTP_LOCKED", "message": "Too many incorrect codes; try again later"})
    if account is None:
        raise HTTPException(status_code=400, detail={"code": "INVALID_OTP", "message": "The verification code is incorrect"})
    if challenge is None:
        raise HTTPException(status_code=400, detail={"code": "OTP_EXPIRED", "message": "Request a new verification code"})
    if as_utc(challenge.expires_at) <= now:
        await session.delete(challenge)
        await session.commit()
        raise HTTPException(status_code=400, detail={"code": "OTP_EXPIRED", "message": "The verification code expired"})
    if not account.is_active:
        raise HTTPException(status_code=403, detail={"code": "ACCOUNT_DISABLED", "message": "This account is disabled"})
    if not verify_otp(key, code, challenge.code_hash, _otp_secret()):
        challenge.attempts_left -= 1
        if challenge.attempts_left <= 0:
            challenge.locked_until = now + OTP_LOCK_TIME
            challenge.attempts_left = 0
            await session.commit()
            raise HTTPException(status_code=429, detail={"code": "OTP_LOCKED", "message": "Too many incorrect codes; try again later"})
        await session.commit()
        raise HTTPException(status_code=400, detail={"code": "INVALID_OTP", "message": "The verification code is incorrect"})

    await session.delete(challenge)
    token = generate_session_token()
    expires_at = now + _session_lifetime(account.role)
    session.add(
        AuthSession(
            account_id=str(account.id),
            token_hash=hash_session_token(token),
            expires_at=expires_at,
        )
    )
    await session.commit()
    return {"expires_at": expires_at.isoformat(), "user": account_user(account)}, token, expires_at


async def get_session_account(session: AsyncSession, token: str | None) -> tuple[Account, AuthSession]:
    if not token:
        raise HTTPException(status_code=401, detail={"code": "UNAUTHORIZED", "message": "Sign-in required"})
    now = utcnow()
    auth_session = await session.scalar(
        select(AuthSession).where(AuthSession.token_hash == hash_session_token(token)).with_for_update()
    )
    if (
        auth_session is None
        or auth_session.revoked_at is not None
        or as_utc(auth_session.expires_at) <= now
    ):
        raise HTTPException(status_code=401, detail={"code": "UNAUTHORIZED", "message": "Session is expired or revoked"})
    try:
        account_id = UUID(auth_session.account_id)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail={"code": "UNAUTHORIZED", "message": "Session is invalid"}) from exc
    account = await session.get(Account, account_id)
    if account is None or not account.is_active:
        auth_session.revoked_at = now
        await session.commit()
        raise HTTPException(status_code=401, detail={"code": "UNAUTHORIZED", "message": "Session is no longer valid"})
    auth_session.last_used_at = now
    await session.commit()
    return account, auth_session


async def logout(session: AsyncSession, auth_session: AuthSession) -> None:
    auth_session.revoked_at = utcnow()
    await session.commit()
