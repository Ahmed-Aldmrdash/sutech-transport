"""Database models for accounts, one-time codes, and server-side sessions."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.common.models import BaseModel


class Account(BaseModel):
    """University account looked up by the identifier entered at sign-in."""

    __tablename__ = "auth_accounts"
    __table_args__ = (UniqueConstraint("identifier_key"),)

    identifier: Mapped[str] = mapped_column(String(64), nullable=False)
    identifier_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    name_ar: Mapped[str | None] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    faculty: Mapped[str | None] = mapped_column(String(200))
    faculty_ar: Mapped[str | None] = mapped_column(String(200))
    level: Mapped[int | None] = mapped_column(Integer)
    guardian_name: Mapped[str | None] = mapped_column(String(200))
    guardian_name_ar: Mapped[str | None] = mapped_column(String(200))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class OTP(BaseModel):
    """Only a keyed hash of the current one-time code is stored."""

    __tablename__ = "auth_otps"
    __table_args__ = (UniqueConstraint("account_id"),)

    account_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts_left: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuthSession(BaseModel):
    """Opaque browser sessions; only the hash of the cookie token is persisted."""

    __tablename__ = "auth_sessions"

    account_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
