"""Database-backed one-use nonce claims for QR scans and GPS ingestion."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import DateTime, String, UniqueConstraint, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.common.models import BaseModel


class SecurityNonce(BaseModel):
    """Unique nonce claim; insert in the same transaction as its protected operation."""

    __tablename__ = "security_nonces"
    __table_args__ = (
        UniqueConstraint("purpose", "subject_id", "nonce"),
    )

    purpose: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    subject_id: Mapped[str] = mapped_column(String(64), nullable=False)
    nonce: Mapped[str] = mapped_column(String(128), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ReplayDetected(ValueError):
    """A nonce was already accepted for this subject and purpose."""


async def claim_nonce(
    session: AsyncSession,
    *,
    purpose: str,
    subject_id: str,
    nonce: str,
    expires_at: datetime,
) -> None:
    """Claim a nonce once; call within the same transaction as the scan or GPS write."""
    if purpose not in {"qr", "gps"}:
        raise ValueError("purpose must be qr or gps")
    if not subject_id or not nonce:
        raise ValueError("subject_id and nonce are required")
    now = datetime.now(UTC)
    if expires_at.tzinfo is None or expires_at <= now:
        raise ValueError("expires_at must be a future timezone-aware datetime")
    try:
        async with session.begin_nested():
            session.add(
                SecurityNonce(
                    purpose=purpose,
                    subject_id=subject_id,
                    nonce=nonce,
                    expires_at=expires_at,
                )
            )
            await session.flush()
    except IntegrityError as exc:
        raise ReplayDetected("Nonce was already used") from exc


async def claim_qr_nonce(session: AsyncSession, claims: dict[str, object]) -> None:
    """Consume a verified QR `jti`; call atomically with the successful boarding write."""
    student_id = claims.get("student_id")
    nonce = claims.get("jti")
    expires = claims.get("exp")
    if not isinstance(student_id, str) or not isinstance(nonce, str) or not isinstance(expires, int):
        raise ValueError("verified QR claims are incomplete")
    await claim_nonce(
        session,
        purpose="qr",
        subject_id=student_id,
        nonce=nonce,
        expires_at=datetime.fromtimestamp(expires, UTC),
    )


async def claim_gps_nonce(
    session: AsyncSession,
    *,
    device_id: str,
    nonce: str,
    now: datetime | None = None,
) -> None:
    """Persist a device nonce longer than the accepted GPS timestamp window."""
    current = now or datetime.now(UTC)
    if current.tzinfo is None:
        current = current.replace(tzinfo=UTC)
    await claim_nonce(
        session,
        purpose="gps",
        subject_id=device_id,
        nonce=nonce,
        expires_at=current + timedelta(minutes=5),
    )


async def purge_expired_nonces(session: AsyncSession, *, now: datetime | None = None) -> int:
    """Maintenance task: remove expired nonce claims in bounded batches."""
    cutoff = now or datetime.now(UTC)
    result = await session.execute(
        delete(SecurityNonce)
        .where(SecurityNonce.expires_at <= cutoff)
        .execution_options(synchronize_session=False)
    )
    return int(result.rowcount or 0)
