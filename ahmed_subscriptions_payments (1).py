"""
==============================================================================
Ahmed's task  ->  app/modules/subscriptions/ + payments/ + card/
Seat reservations, payments & receipts, the digital card (signed QR), and the
student / parent requests (line change, refund, complaint).
==============================================================================

HOW THIS FILE IS ORGANISED (one file for hand-in; split it like this when merging):
    app/modules/subscriptions/{models,schemas,service,router}.py -> sections 2-5A (terms, subscriptions, requests)
    app/modules/payments/{models,service,router}.py             -> sections 5B   (payments, receipts, finance admin)
    app/modules/card/service.py                                 -> section 5C    (Ed25519 QR, `verify_card_token`)
  Requests (line change / refund / complaint + parent approvals + office queue) are kept next to
  subscriptions because they read and change subscriptions.  Muhammad Nabil's scan endpoint imports
  `app.modules.card.service.verify_card_token`, so keep that exact name/location.

TEAM RULES FOLLOWED (doctor + CONTRIBUTING.md):
  * snake_case, UUID primary keys, TIMESTAMPTZ in UTC, money = BigInteger piasters.
  * Plain UUID(as_uuid=True) + index=True for any field that points at another owner's table
    (users, lines, stops...), NO ForeignKey.  Real ForeignKeys only between tables in THIS module.
  * Shared `Base` / `get_db_session`; services commit explicitly; no Alembic revision;
    no edit of app/api/v1/router.py (Muhammad Ali registers the router).

ASSUMPTIONS (change in 2 minutes if the foundation PR differs):
  * Sync SQLAlchemy 2.0 Session.  Auth dependency is Mahmoud's (placeholder below).
  * Errors are HTTPException(detail={"code","message"}); the shared handler flattens them.
  * Field/error names follow the Front/Back agreement (13 Nov).  The PDF text export scrambles
    some underscore names (e.g. "at_expires_hold"), so they were restored to the natural form
    (hold_expires_at ...).  Compare once against frontend/openapi.json.
"""
import base64
import binascii
import enum
import json
import logging
import os
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Callable, Optional
from zoneinfo import ZoneInfo

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field
from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Sequence,
    String,
    Text,
    UniqueConstraint,
    func,
    or_,
    select,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, Session, mapped_column, relationship

from app.db.base import Base
from app.db.session import get_db_session

log = logging.getLogger(__name__)

# =============================================================================
# 1. Constants & helpers
# =============================================================================
CAIRO = ZoneInfo("Africa/Cairo")
UTC = timezone.utc

HOLD_DURATION = timedelta(hours=24)       # TODO(open question): count business days / 48h?
LIVE_SUB_STATUSES = ("reserved", "review_payment", "active")
OPEN_REQUEST_STATUSES = ("guardian_awaiting", "submitted", "in_review")
MAX_FILE_BYTES = 5 * 1024 * 1024
ALLOWED_RECEIPT_TYPES = {"image/jpeg", "image/png", "application/pdf"}
ALLOWED_PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_ATTACHMENTS = 3
CARD_TTL = timedelta(seconds=30)
CARD_PREFIX = "SUT1"
GUARDIAN_CHANGE_WINDOW = timedelta(minutes=10)
PAYOUT_DAYS, PROCESSING_DAYS = 45, 3
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")      # TODO: S3/MinIO + signed links (domain still open)

# Refund policy 2026-2027 (Cairo dates).  9-10 Oct fall to the next stricter row (50%) and
# 30-31 Oct to 100% until Finance confirms (open question in the agreement).
REFUND_SCHEDULE = [
    {"from": date(2026, 9, 20), "to": date(2026, 10, 8), "deduction_percent": 25},
    {"from": date(2026, 10, 9), "to": date(2026, 10, 29), "deduction_percent": 50},
    {"from": date(2026, 10, 30), "to": None, "deduction_percent": 100},
]

DEFAULT_PAYMENT_INSTRUCTIONS = {      # real values are served from payment_settings (Finance edits them)
    "bank_name": "البنك الأهلي المصري", "account_name": None, "account_number": None,
    "iban": None, "swift_code": None, "currency": "EGP",
    "hours_office": None, "room_cashier": "045A", "room_transport": "039A",
}

REQUEST_TITLES = {"change_line": ("طلب تغيير خط السير", "Line change request"),
                  "refund": ("طلب استرداد", "Refund request"),
                  "complaint": ("شكوى", "Complaint")}


def utcnow() -> datetime:
    return datetime.now(UTC)


def cairo_today() -> date:
    return datetime.now(CAIRO).date()


def err(status: int, code: str, message: str = "") -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "message": message or code})


def pg_enum(py_enum: type[enum.Enum], name: str) -> Enum:
    return Enum(py_enum, name=name, values_callable=lambda e: [m.value for m in e])


def emit_event(session: Session, event_type: str, payload: dict) -> None:
    """Notifications / WebSocket hook (owner not assigned yet) - TODO."""
    log.info("event %s %s", event_type, payload)


def record_audit(session: Session, actor_id: uuid.UUID, action: str, area: str, target: str,
                 detail: str = "") -> None:
    """Writes to Muhammad Ali's audit log in the same transaction. TODO: confirm his function name."""
    try:
        from app.common.audit import write_audit  # type: ignore
        write_audit(session, actor_id=actor_id, action=action, area=area, target=target, detail=detail)
    except ImportError:
        log.info("audit %s %s %s %s", action, area, target, detail)


# =============================================================================
# 2. MODELS
# =============================================================================
class SubscriptionStatus(str, enum.Enum):
    reserved = "reserved"
    review_payment = "review_payment"
    active = "active"
    expired = "expired"
    cancelled = "cancelled"


class PaymentMethod(str, enum.Enum):
    bank_deposit = "bank_deposit"
    bank_transfer = "bank_transfer"
    card_at_office = "card_at_office"      # Visa at the accounts office (room 045A)


class PaymentStatus(str, enum.Enum):
    pending_review = "pending_review"
    approved = "approved"
    rejected = "rejected"


class RequestKind(str, enum.Enum):
    change_line = "change_line"
    refund = "refund"
    complaint = "complaint"
    # TODO: model_permit (تصريح المجسم) - its fields are still open in the agreement


class RequestStatus(str, enum.Enum):
    guardian_awaiting = "guardian_awaiting"
    submitted = "submitted"
    in_review = "in_review"
    approved = "approved"
    rejected = "rejected"
    resolved = "resolved"
    withdrawn = "withdrawn"


class RequestActor(str, enum.Enum):
    student = "student"
    guardian = "guardian"
    transport_office = "transport_office"
    finance = "finance"


class LineChangeDuration(str, enum.Enum):
    temporary = "temporary"
    permanent = "permanent"


class RefundReason(str, enum.Enum):
    standard = "standard"
    medical = "medical"
    bereavement = "bereavement"
    transfer = "transfer"


class ComplaintCategory(str, enum.Enum):
    driver_behaviour = "driver_behaviour"
    delay = "delay"
    bus_condition = "bus_condition"
    crowding = "crowding"
    safety = "safety"
    payment = "payment"
    other = "other"


class GuardianDecision(str, enum.Enum):
    approved = "approved"
    refused = "refused"


class Term(Base):
    __tablename__ = "terms"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)     # "Fall 2026-2027"
    starts_on: Mapped[date] = mapped_column(Date, nullable=False)
    ends_on: Mapped[date] = mapped_column(Date, nullable=False)
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class Subscription(Base):
    __tablename__ = "subscriptions"
    __table_args__ = (
        # rule 1: ONE live subscription per student per term
        Index("uq_subscriptions_one_live_per_student_term", "student_id", "term_id", unique=True,
              postgresql_where=text("status IN ('reserved','review_payment','active')")),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)   # users (no FK)
    term_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("terms.id"), nullable=False, index=True)
    line_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)      # lines (Nabil) - no FK
    stop_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)      # stops (Nabil) - no FK
    status: Mapped[SubscriptionStatus] = mapped_column(pg_enum(SubscriptionStatus, "subscription_status"),
                                                       nullable=False, default=SubscriptionStatus.reserved, index=True)
    price_piasters: Mapped[int] = mapped_column(BigInteger, nullable=False)       # fixed at booking time
    hold_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    activated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    term: Mapped["Term"] = relationship()
    payments: Mapped[list["Payment"]] = relationship(back_populates="subscription", order_by="Payment.created_at")


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (
        # the same receipt reference can't be used twice unless the earlier one was rejected
        Index("uq_payments_reference_not_rejected", "reference_number", unique=True,
              postgresql_where=text("status <> 'rejected'")),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subscription_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subscriptions.id"),
                                                       nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)   # users (no FK)
    method: Mapped[PaymentMethod] = mapped_column(pg_enum(PaymentMethod, "payment_method"), nullable=False)
    reference_number: Mapped[str] = mapped_column(String(100), nullable=False)
    amount_piasters: Mapped[int] = mapped_column(BigInteger, nullable=False)
    paid_on: Mapped[date] = mapped_column(Date, nullable=False)
    payer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(pg_enum(PaymentStatus, "payment_status"), nullable=False,
                                                  default=PaymentStatus.pending_review, index=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # receipt file (NULL for Visa-at-office payments)
    file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    file_content_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    file_storage_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)  # users (no FK)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, index=True)

    subscription: Mapped["Subscription"] = relationship(back_populates="payments")


class PaymentSetting(Base):
    """Bank details etc. live in the DB so Finance can change them without a new front build."""
    __tablename__ = "payment_settings"

    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[dict] = mapped_column(JSONB, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)


request_reference_seq = Sequence("request_reference_seq", metadata=Base.metadata)   # ONE counter for all (REQ-2026-0042)


class Request(Base):
    __tablename__ = "requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reference: Mapped[str] = mapped_column(String(30), nullable=False, unique=True)
    kind: Mapped[RequestKind] = mapped_column(pg_enum(RequestKind, "request_kind"), nullable=False, index=True)
    status: Mapped[RequestStatus] = mapped_column(pg_enum(RequestStatus, "request_status"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)   # users (no FK)
    subscription_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("subscriptions.id"),
                                                                 nullable=True, index=True)
    language: Mapped[str] = mapped_column(String(2), nullable=False, default="ar")   # language the student used
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # --- line change
    target_line_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)  # lines (no FK)
    target_stop_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)  # stops (no FK)
    duration: Mapped[Optional[LineChangeDuration]] = mapped_column(pg_enum(LineChangeDuration, "line_change_duration"), nullable=True)
    starts_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    ends_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    applied_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)   # permanent change applied
    student_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    guardian_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    guardian_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    guardian_consent: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    guardian_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)  # users (no FK)
    guardian_decision: Mapped[Optional[GuardianDecision]] = mapped_column(pg_enum(GuardianDecision, "guardian_decision"), nullable=True)
    guardian_decided_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # --- refund
    refund_reason: Mapped[Optional[RefundReason]] = mapped_column(pg_enum(RefundReason, "refund_reason"), nullable=True)
    deduction_percent: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    estimated_refund_piasters: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)   # NULL for exceptional cases
    approved_refund_piasters: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    # --- complaint
    category: Mapped[Optional[ComplaintCategory]] = mapped_column(pg_enum(ComplaintCategory, "complaint_category"), nullable=True)
    line_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)   # lines (no FK)
    happened_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    # --- office handling
    handled_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)  # users (no FK)
    handled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    events: Mapped[list["RequestEvent"]] = relationship(back_populates="request", order_by="RequestEvent.at",
                                                        cascade="all, delete-orphan")
    attachments: Mapped[list["RequestAttachment"]] = relationship(back_populates="request", cascade="all, delete-orphan")


class RequestEvent(Base):
    """Timeline of a request: append-only."""
    __tablename__ = "request_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("requests.id"), nullable=False, index=True)
    status: Mapped[RequestStatus] = mapped_column(pg_enum(RequestStatus, "request_status"), nullable=False)
    by: Mapped[RequestActor] = mapped_column(pg_enum(RequestActor, "request_actor"), nullable=False)
    actor_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)   # users (no FK)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)       # the office reply the student reads
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    request: Mapped["Request"] = relationship(back_populates="events")


class RequestAttachment(Base):
    __tablename__ = "request_attachments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("requests.id"), nullable=False, index=True)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_key: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    request: Mapped["Request"] = relationship(back_populates="attachments")


class SubsIdempotencyKey(Base):
    """Replays the stored response for a repeated Idempotency-Key.
    TODO: Muhammad Ali may merge this with the operations one into a shared table."""
    __tablename__ = "subs_idempotency_keys"
    __table_args__ = (UniqueConstraint("user_id", "key", "endpoint", name="uq_subs_idem_user_key_endpoint"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    endpoint: Mapped[str] = mapped_column(String(120), nullable=False)
    response_body: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


# =============================================================================
# 3. SCHEMAS (request bodies; responses are built as dicts that match the agreement)
# =============================================================================
class SubscribeIn(BaseModel):
    line_id: uuid.UUID
    stop_id: uuid.UUID


class ReceiptFileIn(BaseModel):
    file_name: str = Field(max_length=255)
    content_type: str
    data_base64: str


class ReceiptIn(BaseModel):
    subscription_id: uuid.UUID
    method: PaymentMethod
    reference_number: str = Field(min_length=1, max_length=100)
    amount_piasters: int = Field(gt=0)
    paid_on: date
    payer_name: str = Field(min_length=1, max_length=255)
    receipt: ReceiptFileIn


class LineChangeIn(BaseModel):
    line_id: uuid.UUID
    stop_id: uuid.UUID
    duration: LineChangeDuration
    starts_on: date
    ends_on: Optional[date] = None
    reason: str = Field(min_length=3, max_length=1000)
    student_phone: str
    guardian_name: str
    guardian_phone: str
    guardian_consent: bool


class RefundIn(BaseModel):
    reason: RefundReason
    description: str = Field(min_length=3, max_length=2000)
    guardian_name: str
    guardian_phone: str
    documents: list[ReceiptFileIn] = []


class ComplaintIn(BaseModel):
    category: ComplaintCategory
    line_id: Optional[uuid.UUID] = None
    description: str = Field(min_length=3, max_length=2000)
    happened_on: date
    attachments: list[ReceiptFileIn] = []


class GuardianDecisionIn(BaseModel):
    note: Optional[str] = Field(default=None, max_length=500)


class PaymentDecisionIn(BaseModel):
    decision: str = Field(pattern="^(approve|reject)$")
    reason: Optional[str] = None


class OfficePaymentIn(BaseModel):
    subscription_id: uuid.UUID
    reference_number: str = Field(min_length=1, max_length=100)
    amount_piasters: int = Field(gt=0)
    paid_on: date
    payer_name: str


class RequestActionIn(BaseModel):
    action: str = Field(pattern="^(open|approve|reject|resolve)$")
    note: Optional[str] = Field(default=None, max_length=1000)
    refund_piasters: Optional[int] = Field(default=None, ge=0)


# =============================================================================
# 4. SHARED SERVICE PIECES
# =============================================================================
@dataclass
class CurrentUser:
    id: uuid.UUID
    role: str
    name: str = ""


def get_current_user() -> CurrentUser:
    """PLACEHOLDER - Mahmoud owns auth. Override with his dependency at integration."""
    raise err(501, "AUTH_NOT_INTEGRATED", "Replace get_current_user with the auth module dependency")


def require_roles(*roles: str) -> Callable:
    def dep(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in roles:
            raise err(403, "FORBIDDEN", "Not allowed for this role")
        return user
    return dep


def get_lang(accept_language: str = Header(default="ar")) -> str:
    return "en" if accept_language.strip().lower().startswith("en") else "ar"


def idempotency_key(idempotency_key_header: Optional[str] = Header(default=None, alias="Idempotency-Key")):
    return idempotency_key_header


def run_idempotent(session: Session, user_id: uuid.UUID, key: Optional[str], endpoint: str,
                   fn: Callable[[], dict]) -> dict:
    if not key:
        return fn()
    q = select(SubsIdempotencyKey).where(SubsIdempotencyKey.user_id == user_id,
                                         SubsIdempotencyKey.key == key, SubsIdempotencyKey.endpoint == endpoint)
    found = session.scalar(q)
    if found:
        return found.response_body
    result = jsonable_encoder(fn())
    try:
        session.add(SubsIdempotencyKey(user_id=user_id, key=key, endpoint=endpoint, response_body=result))
        session.commit()
    except IntegrityError:
        session.rollback()
        found = session.scalar(q)
        if found:
            return found.response_body
    return result


# ---- cross-module reads (tables owned by Nabil / Mahmoud / Muhammad Ali) -----------------
# Plain SQL on purpose: no import of other owners' models, no ForeignKey.
# TODO(integration): swap each for the owner's service function once merged.
def line_info(session: Session, line_id: uuid.UUID, lock: bool = False):
    sql = "SELECT id, code, ar_name, en_name, price_piasters, total_seats, is_active FROM lines WHERE id = :i"
    return session.execute(text(sql + (" FOR UPDATE" if lock else "")), {"i": line_id}).first()


def stop_info(session: Session, stop_id: uuid.UUID, line_id: uuid.UUID):
    return session.execute(text("SELECT id, ar_name, en_name FROM stops WHERE id = :s AND line_id = :l"),
                           {"s": stop_id, "l": line_id}).first()


def seats_taken(session: Session, line_id: uuid.UUID) -> int:
    return session.scalar(select(func.count()).select_from(Subscription).where(
        Subscription.line_id == line_id, Subscription.status.in_(LIVE_SUB_STATUSES))) or 0


def user_basic(session: Session, user_id: uuid.UUID) -> dict:
    row = session.execute(text("SELECT name, identifier, phone FROM users WHERE id = :i"), {"i": user_id}).first()
    return {"name": row.name, "identifier": row.identifier, "phone": row.phone} if row else \
           {"name": "", "identifier": "", "phone": None}


def user_by_identifier(session: Session, identifier: str) -> Optional[uuid.UUID]:
    return session.scalar(text("SELECT id FROM users WHERE identifier = :i LIMIT 1"), {"i": identifier.strip()})


def guardian_user_for(session: Session, student_id: uuid.UUID) -> Optional[uuid.UUID]:
    """Guardian ACCOUNT of a student, or None (no account -> line change goes straight to the office).
    Assumed table/columns: guardians(student_id, guardian_user_id) - confirm with Muhammad Ali."""
    return session.scalar(text("SELECT guardian_user_id FROM guardians WHERE student_id = :s LIMIT 1"),
                          {"s": student_id})


def pick_lang(lang: str, ar: Optional[str], en: Optional[str]) -> Optional[str]:
    return (en or ar) if lang == "en" else (ar or en)


# ---- files -----------------------------------------------------------------------------
def decode_file(f: ReceiptFileIn, allowed: set[str]) -> bytes:
    if f.content_type not in allowed:
        raise err(422, "VALIDATION_ERROR", "unsupported file type")
    try:
        data = base64.b64decode(f.data_base64, validate=True)
    except (binascii.Error, ValueError):
        raise err(422, "VALIDATION_ERROR", "file is not valid base64")
    if len(data) > MAX_FILE_BYTES:
        raise err(413, "RECEIPT_TOO_LARGE")
    # TODO: sniff magic bytes so a renamed .exe can't pass as .jpg
    return data


def store_file(data: bytes) -> str:
    """Local-disk default. TODO: S3/MinIO; the domain for signed links is still an open question."""
    key = uuid.uuid4().hex
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    with open(os.path.join(UPLOAD_DIR, key), "wb") as fh:
        fh.write(data)
    return key


def file_url(storage_key: Optional[str]) -> Optional[str]:
    """TODO: return a signed link valid ~15 min that opens in <img> and a new tab with no extra header."""
    return f"/api/v1/files/{storage_key}" if storage_key else None


# =============================================================================
# 5A. SUBSCRIPTIONS
# =============================================================================
def expire_stale_holds(session: Session) -> None:
    """24h hold ended with no receipt -> expired and the seat returns. (review_payment never expires.)
    Called lazily on every read/write here; TODO also run from a 5-minute scheduler."""
    n = session.execute(text(
        "UPDATE subscriptions SET status = 'expired', updated_at = now() "
        "WHERE status = 'reserved' AND hold_expires_at < now()")).rowcount
    if n:
        session.commit()


def current_term(session: Session) -> Term:
    term = session.scalar(select(Term).where(Term.is_current.is_(True)).limit(1))
    if not term:
        raise err(409, "NO_CURRENT_TERM", "No current term is configured")
    return term


def payment_out(p: Payment) -> dict:
    return {"payment_id": str(p.id), "subscription_id": str(p.subscription_id), "method": p.method.value,
            "reference_number": p.reference_number, "amount_piasters": p.amount_piasters, "paid_on": p.paid_on,
            "payer_name": p.payer_name, "status": p.status.value, "rejection_reason": p.rejection_reason,
            "file_name": p.file_name, "created_at": p.created_at, "reviewed_at": p.reviewed_at}


def subscription_out(session: Session, s: Subscription, lang: str = "ar") -> dict:
    line, stop = line_info(session, s.line_id), session.execute(
        text("SELECT ar_name, en_name FROM stops WHERE id = :i"), {"i": s.stop_id}).first()
    latest = s.payments[-1] if s.payments else None
    return {"id": str(s.id), "status": s.status.value, "line_id": str(s.line_id),
            "line": pick_lang(lang, line.ar_name, line.en_name) if line else None,
            "line_code": line.code if line else None, "stop_id": str(s.stop_id),
            "stop_name": pick_lang(lang, stop.ar_name, stop.en_name) if stop else None,
            "price_piasters": s.price_piasters, "hold_expires_at": s.hold_expires_at,
            "activated_at": s.activated_at, "term": s.term.name,
            "latest_payment": payment_out(latest) if latest else None}


def my_subscription(session: Session, student_id: uuid.UUID, lang: str) -> dict:
    expire_stale_holds(session)
    s = session.scalar(select(Subscription).where(Subscription.student_id == student_id)
                       .order_by(Subscription.created_at.desc()).limit(1))
    return {"subscription": subscription_out(session, s, lang) if s else None}    # null, not 404


def create_subscription(session: Session, student_id: uuid.UUID, body: SubscribeIn, lang: str) -> dict:
    expire_stale_holds(session)
    term = current_term(session)
    line = line_info(session, body.line_id, lock=True)       # row lock -> no two students take the last seat
    if not line or not line.is_active:
        raise err(404, "LINE_NOT_FOUND")
    if not stop_info(session, body.stop_id, body.line_id):
        raise err(422, "STOP_NOT_ON_LINE")
    if session.scalar(select(Subscription.id).where(
            Subscription.student_id == student_id, Subscription.term_id == term.id,
            Subscription.status.in_(LIVE_SUB_STATUSES))):
        raise err(409, "ALREADY_SUBSCRIBED")
    if seats_taken(session, body.line_id) >= line.total_seats:
        raise err(409, "SEAT_UNAVAILABLE")
    s = Subscription(student_id=student_id, term_id=term.id, line_id=body.line_id, stop_id=body.stop_id,
                     price_piasters=line.price_piasters, hold_expires_at=utcnow() + HOLD_DURATION)
    session.add(s)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise err(409, "ALREADY_SUBSCRIBED")
    session.refresh(s)
    return subscription_out(session, s, lang)


def cancel_subscription(session: Session, student_id: uuid.UUID, sub_id: uuid.UUID, lang: str) -> dict:
    expire_stale_holds(session)
    s = session.get(Subscription, sub_id)
    if not s or s.student_id != student_id:
        raise err(404, "NOT_FOUND")
    if s.status != SubscriptionStatus.reserved:
        raise err(409, "NOT_CANCELLABLE")
    s.status, s.cancelled_at = SubscriptionStatus.cancelled, utcnow()       # seat returns automatically
    session.commit()
    return subscription_out(session, s, lang)


def active_subscription(session: Session, student_id: uuid.UUID) -> Optional[Subscription]:
    return session.scalar(select(Subscription).where(
        Subscription.student_id == student_id, Subscription.status == SubscriptionStatus.active).limit(1))


def get_effective_line(session: Session, student_id: uuid.UUID, on: Optional[date] = None):
    """(line_id, stop_id) the student actually rides on `on` - honours an approved TEMPORARY line change.
    Permanent changes already moved the subscription itself.  Used by trips/next, card, rosters, tracking."""
    on = on or cairo_today()
    sub = active_subscription(session, student_id)
    if not sub:
        return None
    temp = session.scalar(select(Request).where(
        Request.student_id == student_id, Request.kind == RequestKind.change_line,
        Request.status == RequestStatus.approved, Request.duration == LineChangeDuration.temporary,
        Request.starts_on <= on, Request.ends_on >= on).order_by(Request.handled_at.desc()).limit(1))
    return (temp.target_line_id, temp.target_stop_id) if temp else (sub.line_id, sub.stop_id)


# =============================================================================
# 5B. PAYMENTS & RECEIPTS
# =============================================================================
def payment_instructions(session: Session, student_id: uuid.UUID) -> dict:
    row = session.get(PaymentSetting, "instructions")
    data = {**DEFAULT_PAYMENT_INSTRUCTIONS, **(row.value if row else {})}
    sub = session.scalar(select(Subscription).where(
        Subscription.student_id == student_id,
        Subscription.status.in_(("reserved", "review_payment"))).limit(1))
    data["amount_piasters"] = sub.price_piasters if sub else None
    return data


def my_payments(session: Session, student_id: uuid.UUID) -> list[dict]:
    rows = session.scalars(select(Payment).where(Payment.student_id == student_id)
                           .order_by(Payment.created_at.desc())).all()
    return [payment_out(p) for p in rows]


def submit_receipt(session: Session, student_id: uuid.UUID, body: ReceiptIn) -> dict:
    if body.method == PaymentMethod.card_at_office:
        raise err(422, "VALIDATION_ERROR", "office card payments are recorded by Finance")
    expire_stale_holds(session)
    sub = session.scalar(select(Subscription).where(Subscription.id == body.subscription_id).with_for_update())
    if not sub or sub.student_id != student_id:
        raise err(404, "NOT_FOUND")
    if sub.status == SubscriptionStatus.expired:
        raise err(409, "HOLD_EXPIRED")
    if sub.status != SubscriptionStatus.reserved:
        raise err(409, "NOT_AWAITING_PAYMENT")
    if body.amount_piasters < sub.price_piasters:
        raise err(422, "AMOUNT_MISMATCH")
    if session.scalar(select(Payment.id).where(Payment.reference_number == body.reference_number,
                                               Payment.status != PaymentStatus.rejected)):
        raise err(409, "RECEIPT_ALREADY_USED")
    data = decode_file(body.receipt, ALLOWED_RECEIPT_TYPES)
    p = Payment(subscription_id=sub.id, student_id=student_id, method=body.method,
                reference_number=body.reference_number, amount_piasters=body.amount_piasters,
                paid_on=body.paid_on, payer_name=body.payer_name, file_name=body.receipt.file_name,
                file_content_type=body.receipt.content_type, file_size_bytes=len(data),
                file_storage_key=store_file(data))
    session.add(p)
    sub.status = SubscriptionStatus.review_payment      # seat stays held while Finance reviews
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise err(409, "RECEIPT_ALREADY_USED")
    return payment_out(p)


# ---- Finance office ---------------------------------------------------------------------------
def _student_ids_matching(session: Session, q: str) -> list[uuid.UUID]:
    rows = session.execute(text("SELECT id FROM users WHERE identifier ILIKE :q OR name ILIKE :q"),
                           {"q": f"%{q}%"}).all()
    return [r.id for r in rows]


def admin_payment_out(session: Session, p: Payment, lang: str = "ar", detail: bool = False) -> dict:
    sub = p.subscription
    stu = user_basic(session, p.student_id)
    out = {**payment_out(p), "student": {"student_id": str(p.student_id), **stu},
           "reviewed_by_name": user_basic(session, p.reviewed_by)["name"] if p.reviewed_by else None,
           "file_content_type": p.file_content_type, "file_url": file_url(p.file_storage_key)}
    if detail:
        line = line_info(session, sub.line_id)
        stop = session.execute(text("SELECT ar_name, en_name FROM stops WHERE id = :i"), {"i": sub.stop_id}).first()
        others = [payment_out(o) for o in sub.payments if o.id != p.id]
        out.update({"line": pick_lang(lang, line.ar_name, line.en_name) if line else None,
                    "stop_name": pick_lang(lang, stop.ar_name, stop.en_name) if stop else None,
                    "price_piasters": sub.price_piasters, "subscription_status": sub.status.value,
                    "other_payments": others})
    return out


def admin_list_payments(session: Session, status: Optional[str], q: Optional[str], page: int,
                        page_size: int) -> dict:
    base = select(Payment)
    if status:
        try:
            base = base.where(Payment.status == PaymentStatus(status))
        except ValueError:
            raise err(422, "VALIDATION_ERROR", "unknown status")
    if q:
        ids = _student_ids_matching(session, q)
        base = base.where(or_(Payment.student_id.in_(ids) if ids else False,
                              Payment.reference_number.ilike(f"%{q}%")))
    total = session.scalar(select(func.count()).select_from(base.subquery()))
    pending_first = (Payment.status != PaymentStatus.pending_review)
    rows = session.scalars(base.order_by(
        pending_first, func.coalesce(Payment.reviewed_at, Payment.created_at).asc()
        if not status or status == "pending_review" else Payment.reviewed_at.desc())
        .limit(page_size).offset((page - 1) * page_size)).all()
    counts = dict(session.execute(select(Payment.status, func.count()).group_by(Payment.status)).all())
    return {"items": [admin_payment_out(session, p) for p in rows], "total": total,
            "counts": {s.value: counts.get(s, 0) for s in PaymentStatus}}


def admin_get_payment(session: Session, payment_id: uuid.UUID, lang: str) -> dict:
    p = session.get(Payment, payment_id)
    if not p:
        raise err(404, "NOT_FOUND")
    return admin_payment_out(session, p, lang, detail=True)


def admin_decide_payment(session: Session, user: CurrentUser, payment_id: uuid.UUID,
                         body: PaymentDecisionIn) -> dict:
    p = session.scalar(select(Payment).where(Payment.id == payment_id).with_for_update())
    if not p:
        raise err(404, "NOT_FOUND")
    if p.status != PaymentStatus.pending_review:
        raise err(409, "PAYMENT_ALREADY_REVIEWED")
    sub, now = p.subscription, utcnow()
    p.reviewed_by, p.reviewed_at = user.id, now
    if body.decision == "approve":
        p.status = PaymentStatus.approved
        sub.status, sub.activated_at, sub.hold_expires_at = SubscriptionStatus.active, now, None
        action, event = "approved_payment", "payment_approved"
    else:
        if not body.reason or len(body.reason.strip()) < 3:
            raise err(422, "REASON_REQUIRED")
        p.status, p.rejection_reason = PaymentStatus.rejected, body.reason.strip()
        # seat gets a fresh 24h hold so the student can upload again
        sub.status, sub.hold_expires_at = SubscriptionStatus.reserved, now + HOLD_DURATION
        action, event = "payment_rejected", "payment_rejected"
    record_audit(session, user.id, action, "payments", str(p.id), p.reference_number)   # same transaction
    session.commit()
    emit_event(session, "notification.new", {"user_id": str(p.student_id), "kind": event})
    return admin_payment_out(session, p, detail=True)


def admin_awaiting_booking(session: Session, identifier: str, lang: str) -> dict:
    expire_stale_holds(session)
    sid = user_by_identifier(session, identifier)
    if not sid:
        raise err(404, "STUDENT_NOT_FOUND")
    sub = session.scalar(select(Subscription).where(Subscription.student_id == sid,
                                                    Subscription.status == SubscriptionStatus.reserved).limit(1))
    if not sub:
        raise err(409, "NOT_AWAITING_PAYMENT")
    out = subscription_out(session, sub, lang)
    out["student"] = {"student_id": str(sid), **user_basic(session, sid)}
    return out


def admin_office_payment(session: Session, user: CurrentUser, body: OfficePaymentIn) -> dict:
    expire_stale_holds(session)
    sub = session.scalar(select(Subscription).where(Subscription.id == body.subscription_id).with_for_update())
    if not sub:
        raise err(404, "NOT_FOUND")
    if sub.status == SubscriptionStatus.expired:
        raise err(409, "HOLD_EXPIRED")
    if sub.status != SubscriptionStatus.reserved:
        raise err(409, "NOT_AWAITING_PAYMENT")
    if body.amount_piasters < sub.price_piasters:
        raise err(422, "AMOUNT_MISMATCH")
    if session.scalar(select(Payment.id).where(Payment.reference_number == body.reference_number,
                                               Payment.status != PaymentStatus.rejected)):
        raise err(409, "RECEIPT_ALREADY_USED")
    now = utcnow()
    p = Payment(subscription_id=sub.id, student_id=sub.student_id, method=PaymentMethod.card_at_office,
                reference_number=body.reference_number, amount_piasters=body.amount_piasters,
                paid_on=body.paid_on, payer_name=body.payer_name, status=PaymentStatus.approved,
                reviewed_by=user.id, reviewed_at=now)
    session.add(p)
    sub.status, sub.activated_at, sub.hold_expires_at = SubscriptionStatus.active, now, None   # seat active at once
    record_audit(session, user.id, "office_payment", "payments", str(sub.id), body.reference_number)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise err(409, "RECEIPT_ALREADY_USED")
    emit_event(session, "notification.new", {"user_id": str(sub.student_id), "kind": "payment_approved"})
    return admin_payment_out(session, p, detail=True)


# =============================================================================
# 5C. DIGITAL CARD  (Ed25519-signed QR, 30 s)
# =============================================================================
_card_key: Optional[Ed25519PrivateKey] = None


def _signing_key() -> Ed25519PrivateKey:
    """Key comes from CARD_ED25519_PRIVATE_KEY (base64 of the 32 raw bytes) - Mahmoud's QR security
    review owns key custody/rotation. Without it a throw-away dev key is made (tokens die on restart)."""
    global _card_key
    if _card_key is None:
        raw = os.getenv("CARD_ED25519_PRIVATE_KEY")
        if raw:
            _card_key = Ed25519PrivateKey.from_private_bytes(base64.b64decode(raw))
        else:
            log.warning("CARD_ED25519_PRIVATE_KEY not set - using an ephemeral dev key")
            _card_key = Ed25519PrivateKey.generate()
    return _card_key


def _b64u(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _b64u_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def issue_card_token(student_id: uuid.UUID, sub_id: uuid.UUID, line_id: uuid.UUID) -> tuple[str, datetime]:
    now = utcnow()
    exp = now + CARD_TTL
    payload = json.dumps({"v": 1, "sid": str(student_id), "sub": str(sub_id), "line": str(line_id),
                          "iat": int(now.timestamp()), "exp": int(exp.timestamp()), "jti": uuid.uuid4().hex},
                         separators=(",", ":")).encode()
    sig = _signing_key().sign(payload)
    return f"{CARD_PREFIX}.{_b64u(payload)}.{_b64u(sig)}", exp


def verify_card_token(session: Session, token: str) -> dict:
    """Used by Nabil's /trips/{id}/scan. Returns {"student_id","subscription_id","line_id"} (UUIDs)
    or raises CARD_INVALID / CARD_EXPIRED. Cancelled / non-active subscriptions are rejected."""
    try:
        prefix, p64, s64 = token.split(".")
        if prefix != CARD_PREFIX:
            raise ValueError
        payload = _b64u_decode(p64)
        _signing_key().public_key().verify(_b64u_decode(s64), payload)
        data = json.loads(payload)
        student_id, sub_id = uuid.UUID(data["sid"]), uuid.UUID(data["sub"])
        exp = int(data["exp"])
    except (ValueError, KeyError, InvalidSignature, binascii.Error, json.JSONDecodeError):
        raise err(400, "CARD_INVALID")
    if utcnow().timestamp() > exp:
        raise err(400, "CARD_EXPIRED")
    sub = session.get(Subscription, sub_id)
    if not sub or sub.student_id != student_id or sub.status != SubscriptionStatus.active:
        raise err(400, "CARD_INVALID")
    return {"student_id": student_id, "subscription_id": sub_id, "line_id": sub.line_id}


def my_card(session: Session, student_id: uuid.UUID, lang: str) -> dict:
    expire_stale_holds(session)
    sub = active_subscription(session, student_id)
    if not sub:
        raise err(403, "NOT_SUBSCRIBED")
    line_id, stop_id = get_effective_line(session, student_id) or (sub.line_id, sub.stop_id)
    line = line_info(session, line_id)
    stop = session.execute(text("SELECT ar_name, en_name FROM stops WHERE id = :i"), {"i": stop_id}).first()
    token, exp = issue_card_token(student_id, sub.id, line_id)
    return {"student": {"student_id": str(student_id), **user_basic(session, student_id)},
            "line": {"id": str(line_id), "code": line.code if line else None,
                     "name": pick_lang(lang, line.ar_name, line.en_name) if line else None},
            "stop_name": pick_lang(lang, stop.ar_name, stop.en_name) if stop else None,
            "term": sub.term.name, "valid_until": sub.term.ends_on,
            # token valid 30 s; the front fetches a new one 3 s before expiry
            "qr": {"token": token, "expires_at": exp}}


# =============================================================================
# 5D. REQUESTS (line change / refund / complaint) + parent approvals + office queue
# =============================================================================
def _title(kind: RequestKind, lang: str) -> str:
    ar, en = REQUEST_TITLES[kind.value]
    return en if lang == "en" else ar


def deduction_for(d: date) -> int:
    if d < REFUND_SCHEDULE[0]["from"]:
        return 0
    for row in REFUND_SCHEDULE:
        if row["to"] is None or d <= row["to"]:
            return row["deduction_percent"]
    return 100


def paid_piasters(session: Session, sub: Subscription) -> int:
    return session.scalar(select(func.coalesce(func.sum(Payment.amount_piasters), 0)).where(
        Payment.subscription_id == sub.id, Payment.status == PaymentStatus.approved)) or 0


def request_out(session: Session, r: Request, lang: str = "ar", viewer: str = "student") -> dict:
    out = {"request_id": str(r.id), "reference": r.reference, "kind": r.kind.value, "status": r.status.value,
           "title": _title(r.kind, lang), "description": r.description, "language": r.language,
           "created_at": r.created_at, "updated_at": r.updated_at,
           "timeline": [{"status": e.status.value, "at": e.at, "by": e.by.value, "note": e.note} for e in r.events],
           "attachments": [{"id_attachment": str(a.id), "name_file": a.file_name, "type_content": a.content_type,
                            "bytes_size": a.size_bytes, "url": file_url(a.storage_key)} for a in r.attachments]}
    if r.kind == RequestKind.change_line:
        line = line_info(session, r.target_line_id) if r.target_line_id else None
        out.update({"line_id": str(r.target_line_id), "stop_id": str(r.target_stop_id),
                    "line": pick_lang(lang, line.ar_name, line.en_name) if line else None,
                    "duration": r.duration.value if r.duration else None, "starts_on": r.starts_on,
                    "ends_on": r.ends_on, "student_phone": r.student_phone, "guardian_name": r.guardian_name,
                    "guardian_phone": r.guardian_phone, "guardian_consent": r.guardian_consent})
    elif r.kind == RequestKind.refund:
        out.update({"reason": r.refund_reason.value if r.refund_reason else None,
                    "deduction_percent": r.deduction_percent,
                    "estimated_refund_piasters": r.estimated_refund_piasters,
                    "approved_refund_piasters": r.approved_refund_piasters,
                    "guardian_name": r.guardian_name, "guardian_phone": r.guardian_phone,
                    "payout_days": PAYOUT_DAYS})
    else:
        out.update({"category": r.category.value if r.category else None,
                    "line_id": str(r.line_id) if r.line_id else None,
                    "happened_on": r.happened_on})
    return out


def _add_event(r: Request, status: RequestStatus, by: RequestActor, user_id: Optional[uuid.UUID],
               note: Optional[str] = None) -> None:
    r.status = status
    r.events.append(RequestEvent(status=status, by=by, actor_user_id=user_id, note=note))


def _next_reference(session: Session) -> str:
    n = session.scalar(select(request_reference_seq.next_value()))
    return f"REQ-{datetime.now(CAIRO).year}-{int(n):04d}"


def _assert_none_open(session: Session, student_id: uuid.UUID, kind: RequestKind) -> None:
    if session.scalar(select(Request.id).where(Request.student_id == student_id, Request.kind == kind,
                                               Request.status.in_(OPEN_REQUEST_STATUSES))):
        raise err(409, "REQUEST_ALREADY_OPEN")


def _save_attachments(r: Request, files: list[ReceiptFileIn], allowed: set[str]) -> None:
    if len(files) > MAX_ATTACHMENTS:
        raise err(422, "VALIDATION_ERROR", f"at most {MAX_ATTACHMENTS} files")
    for f in files:
        data = decode_file(f, allowed)
        r.attachments.append(RequestAttachment(file_name=f.file_name, content_type=f.content_type,
                                               size_bytes=len(data), storage_key=store_file(data)))


def _commit_new_request(session: Session, r: Request, lang: str) -> dict:
    session.add(r)
    session.commit()
    emit_event(session, "notification.new", {"user_id": str(r.student_id), "kind": "request_update",
                                             "request_id": str(r.id)})
    return request_out(session, r, lang)


def refund_policy(session: Session, student_id: uuid.UUID) -> dict:
    today = cairo_today()
    sub = active_subscription(session, student_id)
    paid = paid_piasters(session, sub) if sub else None
    ded = deduction_for(today)
    return {"schedule": [{"from": s["from"], "to": s["to"], "deduction_percent": s["deduction_percent"]}
                         for s in REFUND_SCHEDULE],
            "today": today, "deduction_percent_today": ded, "paid_piasters": paid,
            "estimated_refund_piasters": (paid * (100 - ded)) // 100 if paid is not None else None,
            "payout_days": PAYOUT_DAYS, "processing_days": PROCESSING_DAYS}


def create_line_change(session: Session, user: CurrentUser, body: LineChangeIn, lang: str) -> dict:
    sub = active_subscription(session, user.id)
    if not sub:
        raise err(409, "NO_ACTIVE_SUBSCRIPTION")
    _assert_none_open(session, user.id, RequestKind.change_line)
    if body.line_id == sub.line_id:
        raise err(422, "SAME_LINE")
    if not line_info(session, body.line_id):
        raise err(404, "LINE_NOT_FOUND")
    if not stop_info(session, body.stop_id, body.line_id):
        raise err(422, "STOP_NOT_ON_LINE")
    term = sub.term
    today = cairo_today()
    if (body.starts_on < today or body.starts_on > term.ends_on
            or (body.duration == LineChangeDuration.temporary and
                (not body.ends_on or body.ends_on < body.starts_on or body.ends_on > term.ends_on))):
        raise err(422, "INVALID_DATES")
    if not body.guardian_consent:
        raise err(422, "VALIDATION_ERROR", "guardian_consent must be true")
    guardian_user = guardian_user_for(session, user.id)
    r = Request(reference=_next_reference(session), kind=RequestKind.change_line, student_id=user.id,
                subscription_id=sub.id, language=lang, description=body.reason,
                target_line_id=body.line_id, target_stop_id=body.stop_id, duration=body.duration,
                starts_on=body.starts_on, ends_on=body.ends_on if body.duration == LineChangeDuration.temporary else None,
                student_phone=body.student_phone, guardian_name=body.guardian_name,
                guardian_phone=body.guardian_phone, guardian_consent=True, guardian_user_id=guardian_user,
                status=RequestStatus.submitted)
    # guardian with an app account approves first; without one the request goes straight to the office
    first = RequestStatus.guardian_awaiting if guardian_user else RequestStatus.submitted
    _add_event(r, first, RequestActor.student, user.id)
    return _commit_new_request(session, r, lang)


def create_refund(session: Session, user: CurrentUser, body: RefundIn, lang: str) -> dict:
    sub = active_subscription(session, user.id)
    paid = paid_piasters(session, sub) if sub else 0
    if not sub or paid <= 0:
        raise err(409, "NO_ACTIVE_SUBSCRIPTION")
    _assert_none_open(session, user.id, RequestKind.refund)
    ded, estimated = deduction_for(cairo_today()), None
    if body.reason == RefundReason.standard:
        if ded >= 100:
            raise err(422, "REFUND_WINDOW_CLOSED")
        estimated = (paid * (100 - ded)) // 100
    elif not body.documents:                       # medical / bereavement / transfer: Uni decides on documents
        raise err(422, "DOCUMENTS_REQUIRED")
    r = Request(reference=_next_reference(session), kind=RequestKind.refund, student_id=user.id,
                subscription_id=sub.id, language=lang, description=body.description,
                refund_reason=body.reason, deduction_percent=ded, estimated_refund_piasters=estimated,
                guardian_name=body.guardian_name, guardian_phone=body.guardian_phone,
                status=RequestStatus.submitted)
    _save_attachments(r, body.documents, ALLOWED_RECEIPT_TYPES)
    _add_event(r, RequestStatus.submitted, RequestActor.student, user.id)
    return _commit_new_request(session, r, lang)


def create_complaint(session: Session, user: CurrentUser, body: ComplaintIn, lang: str) -> dict:
    expire_stale_holds(session)
    if body.category == ComplaintCategory.payment:
        sub = session.scalar(select(Subscription).where(Subscription.student_id == user.id)
                             .order_by(Subscription.created_at.desc()).limit(1))   # any booking is enough
        if not sub:
            raise err(409, "NO_SUBSCRIPTION")
    else:
        sub = active_subscription(session, user.id)
        if not sub:
            raise err(409, "NO_ACTIVE_SUBSCRIPTION")
    if body.happened_on > cairo_today():
        raise err(422, "INVALID_DATES")
    if body.line_id and not line_info(session, body.line_id):
        raise err(404, "LINE_NOT_FOUND")
    _assert_none_open(session, user.id, RequestKind.complaint)
    r = Request(reference=_next_reference(session), kind=RequestKind.complaint, student_id=user.id,
                subscription_id=sub.id, language=lang, description=body.description, category=body.category,
                line_id=body.line_id, happened_on=body.happened_on, status=RequestStatus.submitted)
    _save_attachments(r, body.attachments, ALLOWED_PHOTO_TYPES | ALLOWED_RECEIPT_TYPES)
    _add_event(r, RequestStatus.submitted, RequestActor.student, user.id)
    return _commit_new_request(session, r, lang)


def my_requests(session: Session, student_id: uuid.UUID, kind: Optional[str], lang: str) -> list[dict]:
    q = select(Request).where(Request.student_id == student_id)
    if kind:
        try:
            q = q.where(Request.kind == RequestKind(kind))
        except ValueError:
            raise err(422, "VALIDATION_ERROR", "unknown kind")
    return [request_out(session, r, lang) for r in session.scalars(q.order_by(Request.created_at.desc()))]


def get_my_request(session: Session, student_id: uuid.UUID, request_id: uuid.UUID, lang: str) -> dict:
    r = session.get(Request, request_id)
    if not r or r.student_id != student_id:        # someone else's request -> 404, never 403
        raise err(404, "NOT_FOUND")
    return request_out(session, r, lang)


def withdraw_request(session: Session, student_id: uuid.UUID, request_id: uuid.UUID, lang: str) -> dict:
    r = session.scalar(select(Request).where(Request.id == request_id).with_for_update())
    if not r or r.student_id != student_id:
        raise err(404, "NOT_FOUND")
    if r.status not in (RequestStatus.guardian_awaiting, RequestStatus.submitted):
        raise err(409, "NOT_WITHDRAWABLE")           # the office has already opened it
    _add_event(r, RequestStatus.withdrawn, RequestActor.student, student_id)
    session.commit()
    return request_out(session, r, lang)


# ---- parent approvals (line change only) --------------------------------------------------------
def _change_window_end(r: Request) -> Optional[datetime]:
    """Guardian may flip their answer for 10 minutes while the office hasn't opened the request."""
    if not r.guardian_decided_at or r.handled_by is not None:
        return None
    ok_status = (r.status == RequestStatus.submitted and r.guardian_decision == GuardianDecision.approved) or \
                (r.status == RequestStatus.rejected and r.guardian_decision == GuardianDecision.refused)
    end = r.guardian_decided_at + GUARDIAN_CHANGE_WINDOW
    return end if ok_status and utcnow() < end else None


def parent_approvals(session: Session, guardian_id: uuid.UUID, lang: str) -> dict:
    rows = session.scalars(select(Request).where(
        Request.kind == RequestKind.change_line, Request.guardian_user_id == guardian_id,
        or_(Request.status == RequestStatus.guardian_awaiting, Request.guardian_decided_at.is_not(None)))
        .order_by(Request.created_at.desc())).all()
    return {"approvals": [{"student_id": str(r.student_id), "student_name": user_basic(session, r.student_id)["name"],
                           "request": request_out(session, r, lang, viewer="guardian"),
                           "until_change_can": _change_window_end(r)} for r in rows]}


def parent_decide(session: Session, guardian: CurrentUser, request_id: uuid.UUID, approve: bool,
                  body: GuardianDecisionIn, lang: str) -> dict:
    r = session.scalar(select(Request).where(Request.id == request_id).with_for_update())
    if not r or r.kind != RequestKind.change_line:
        raise err(404, "NOT_FOUND")
    if r.guardian_user_id != guardian.id:
        raise err(403, "NOT_YOUR_CHILD")
    if r.status != RequestStatus.guardian_awaiting and not _change_window_end(r):
        raise err(409, "NOT_AWAITING_GUARDIAN")
    r.guardian_decision = GuardianDecision.approved if approve else GuardianDecision.refused
    r.guardian_decided_at = utcnow()
    _add_event(r, RequestStatus.submitted if approve else RequestStatus.rejected, RequestActor.guardian,
               guardian.id, body.note)           # refused requests never reach the office
    session.commit()
    emit_event(session, "notification.new", {"user_id": str(r.student_id), "kind": "request_update",
                                             "request_id": str(r.id)})
    return {"approval": {"student_id": str(r.student_id), "request": request_out(session, r, lang, "guardian"),
                         "until_change_can": _change_window_end(r)}}


# ---- office queue (transport_admin / finance / super_admin) ------------------------------------------
OFFICE_KINDS = {
    "finance": lambda: or_(Request.kind == RequestKind.refund,
                           (Request.kind == RequestKind.complaint) & (Request.category == ComplaintCategory.payment)),
    "transport_admin": lambda: or_(Request.kind == RequestKind.change_line,
                                   (Request.kind == RequestKind.complaint) & (Request.category != ComplaintCategory.payment)),
}
STAGE_STATUSES = {"new": (RequestStatus.submitted,), "in_review": (RequestStatus.in_review,),
                  "closed": (RequestStatus.approved, RequestStatus.rejected, RequestStatus.resolved)}
SUGGESTED_REPLIES = {
    "ar": {"open": "جاري مراجعة طلبك.", "approve": "تمت الموافقة على طلبك.",
           "reject": "نعتذر، لا يمكن قبول الطلب.", "resolve": "تم حل الشكوى. شكراً لتواصلك."},
    "en": {"open": "Your request is being reviewed.", "approve": "Your request has been approved.",
           "reject": "Sorry, we can't accept this request.", "resolve": "Your complaint has been resolved."},
}


def _office_visible(role: str, r: Request) -> bool:
    if role == "super_admin":
        return r.status != RequestStatus.guardian_awaiting
    cond_kind = (r.kind == RequestKind.refund) or (r.kind == RequestKind.complaint and r.category == ComplaintCategory.payment)
    return (cond_kind if role == "finance" else not cond_kind) and r.status != RequestStatus.guardian_awaiting


def _stage(r: Request) -> str:
    return "new" if r.status == RequestStatus.submitted else "in_review" if r.status == RequestStatus.in_review else "closed"


def _allowed_actions(r: Request) -> list[str]:
    if r.status in (RequestStatus.approved, RequestStatus.rejected, RequestStatus.resolved,
                    RequestStatus.withdrawn, RequestStatus.guardian_awaiting):
        return []
    end = ["resolve", "reject"] if r.kind == RequestKind.complaint else ["approve", "reject"]
    # approve/reject without `open` first is allowed (fewer steps for the office)
    return (["open"] if r.status == RequestStatus.submitted else []) + end


def admin_request_row(session: Session, r: Request, lang: str) -> dict:
    stu = user_basic(session, r.student_id)
    return {"request_id": str(r.id), "reference": r.reference, "kind": r.kind.value, "status": r.status.value,
            "stage": _stage(r), "title": _title(r.kind, lang),
            "student": {"name": stu["name"], "identifier": stu["identifier"]},
            "received_at": r.created_at, "updated_at": r.updated_at,
            "handled_by_name": user_basic(session, r.handled_by)["name"] if r.handled_by else None}


def admin_list_requests(session: Session, user: CurrentUser, kinds: list[str], stage: Optional[str],
                        q: Optional[str], page: int, page_size: int, lang: str) -> dict:
    base = select(Request).where(Request.status.not_in((RequestStatus.guardian_awaiting, RequestStatus.withdrawn)))
    if user.role in OFFICE_KINDS:
        base = base.where(OFFICE_KINDS[user.role]())        # Finance never sees line changes, Transport never refunds
    if kinds:
        base = base.where(Request.kind.in_([RequestKind(k) for k in kinds if k in RequestKind._value2member_map_]))
    if stage in STAGE_STATUSES:
        base = base.where(Request.status.in_(STAGE_STATUSES[stage]))
    if q:
        ids = _student_ids_matching(session, q)
        base = base.where(or_(Request.student_id.in_(ids) if ids else False, Request.reference.ilike(f"%{q}%")))
    total = session.scalar(select(func.count()).select_from(base.subquery()))
    rows = session.scalars(base.order_by(Request.created_at.desc()).limit(page_size).offset((page - 1) * page_size)).all()
    counts = dict(session.execute(select(Request.status, func.count()).where(
        Request.status.in_([s for ss in STAGE_STATUSES.values() for s in ss])).group_by(Request.status)).all())
    return {"items": [admin_request_row(session, r, lang) for r in rows], "total": total,
            "counts": {k: sum(counts.get(s, 0) for s in v) for k, v in STAGE_STATUSES.items()}}


def _office_request(session: Session, user: CurrentUser, request_id: uuid.UUID, lock: bool = False) -> Request:
    q = select(Request).where(Request.id == request_id)
    r = session.scalar(q.with_for_update() if lock else q)
    if not r or r.status == RequestStatus.guardian_awaiting:
        raise err(404, "NOT_FOUND")
    if not _office_visible(user.role, r):
        raise err(403, "FORBIDDEN")                  # another office's request
    return r


def admin_get_request(session: Session, user: CurrentUser, request_id: uuid.UUID, lang: str) -> dict:
    r = _office_request(session, user, request_id)
    stu = user_basic(session, r.student_id)
    sub = r.subscription_id and session.get(Subscription, r.subscription_id)
    seats = None
    if r.kind == RequestKind.change_line and r.target_line_id:
        t = line_info(session, r.target_line_id)
        seats = max(t.total_seats - seats_taken(session, r.target_line_id), 0) if t else None
    out = request_out(session, r, lang)
    out.update({"stage": _stage(r), "student": {"student_id": str(r.student_id), **stu,
                                                "subscription_status": sub.status.value if sub else None},
                "allowed_actions": _allowed_actions(r), "target_seats_available": seats,
                # replies are written in the language the STUDENT used, not the staff member's screen language
                "language_reply": r.language, "suggested_replies": SUGGESTED_REPLIES[r.language],
                "guardian_has_account": r.guardian_user_id is not None if r.kind == RequestKind.change_line else None,
                "handled_by_name": user_basic(session, r.handled_by)["name"] if r.handled_by else None})
    return out


def admin_act_on_request(session: Session, user: CurrentUser, request_id: uuid.UUID,
                         body: RequestActionIn, lang: str) -> dict:
    r = _office_request(session, user, request_id, lock=True)
    if body.action not in _allowed_actions(r):
        if r.status in (RequestStatus.approved, RequestStatus.rejected, RequestStatus.resolved):
            raise err(409, "REQUEST_CLOSED")
        raise err(422, "ACTION_NOT_ALLOWED")
    actor = RequestActor.finance if user.role == "finance" else RequestActor.transport_office
    note = (body.note or "").strip() or None
    if body.action in ("reject", "resolve") and (not note or len(note) < 5):
        raise err(422, "NOTE_REQUIRED")

    if body.action == "open":
        new_status = RequestStatus.in_review
    elif body.action == "reject":
        new_status = RequestStatus.rejected
    elif body.action == "resolve":
        new_status = RequestStatus.resolved
    else:                                                     # approve
        new_status = RequestStatus.approved
        sub = session.get(Subscription, r.subscription_id)
        if r.kind == RequestKind.change_line:
            tgt = line_info(session, r.target_line_id, lock=True)
            if not tgt or seats_taken(session, r.target_line_id) >= tgt.total_seats:
                raise err(409, "SEAT_UNAVAILABLE")            # needs a free seat on the new line
        elif r.kind == RequestKind.refund:
            paid = paid_piasters(session, sub)
            if r.refund_reason == RefundReason.standard:
                r.approved_refund_piasters = r.estimated_refund_piasters
            else:                                             # exceptional: office decides 0..paid
                if body.refund_piasters is None or not (0 <= body.refund_piasters <= paid):
                    raise err(422, "REFUND_AMOUNT_INVALID")
                r.approved_refund_piasters = body.refund_piasters
            sub.status, sub.cancelled_at = SubscriptionStatus.cancelled, utcnow()   # approved refund cancels the subscription
    r.handled_by, r.handled_at = user.id, utcnow()
    _add_event(r, new_status, actor, user.id, note)
    if new_status == RequestStatus.approved and r.kind == RequestKind.change_line:
        apply_line_change(session, r)
    record_audit(session, user.id, f"request_{new_status.value if new_status != RequestStatus.in_review else 'opened'}",
                 "requests", r.reference, note or "")        # same transaction as the decision
    session.commit()
    emit_event(session, "notification.new", {"user_id": str(r.student_id), "kind": "request_update",
                                             "request_id": str(r.id)})
    return admin_get_request(session, user, request_id, lang)


def apply_line_change(session: Session, r: Request) -> None:
    """Permanent change: move the subscription on starts_on (now if already due).
    Temporary changes are NOT written to the subscription - get_effective_line() resolves them by date."""
    if r.duration == LineChangeDuration.permanent and r.applied_at is None and r.starts_on <= cairo_today():
        sub = session.get(Subscription, r.subscription_id)
        sub.line_id, sub.stop_id, r.applied_at = r.target_line_id, r.target_stop_id, utcnow()


def apply_due_line_changes(session: Session) -> int:
    """For a daily scheduler (TODO): applies approved permanent changes whose starts_on has arrived."""
    n = 0
    for r in session.scalars(select(Request).where(
            Request.kind == RequestKind.change_line, Request.status == RequestStatus.approved,
            Request.duration == LineChangeDuration.permanent, Request.applied_at.is_(None))):
        before = r.applied_at
        apply_line_change(session, r)
        n += 1 if r.applied_at != before else 0
    session.commit()
    return n


# =============================================================================
# 6. ROUTER   (Muhammad Ali registers `router`; split into subscriptions/payments/card routers when merging)
# =============================================================================
router = APIRouter(tags=["subscriptions"])
Db = Depends(get_db_session)
student_only = require_roles("student")
parent_only = require_roles("parent")
finance_office = require_roles("finance", "super_admin")
requests_office = require_roles("finance", "transport_admin", "super_admin")


# ---- subscriptions -----------------------------------------------------------------------------
@router.get("/me/subscriptions")
def get_my_subscription(session: Session = Db, lang: str = Depends(get_lang),
                        user: CurrentUser = Depends(student_only)):
    return my_subscription(session, user.id, lang)


@router.post("/subscriptions", status_code=201)
def post_subscription(body: SubscribeIn, session: Session = Db, lang: str = Depends(get_lang),
                      user: CurrentUser = Depends(student_only), key: Optional[str] = Depends(idempotency_key)):
    return run_idempotent(session, user.id, key, "POST /subscriptions",
                          lambda: create_subscription(session, user.id, body, lang))


@router.post("/subscriptions/{sub_id}/cancel")
def post_cancel_subscription(sub_id: uuid.UUID, session: Session = Db, lang: str = Depends(get_lang),
                             user: CurrentUser = Depends(student_only),
                             key: Optional[str] = Depends(idempotency_key)):
    return run_idempotent(session, user.id, key, f"POST /subscriptions/{sub_id}/cancel",
                          lambda: cancel_subscription(session, user.id, sub_id, lang))


# ---- payments ----------------------------------------------------------------------------------
@router.get("/payments/instructions")
def get_payment_instructions(session: Session = Db, user: CurrentUser = Depends(student_only)):
    return payment_instructions(session, user.id)


@router.get("/me/payments")
def get_my_payments(session: Session = Db, user: CurrentUser = Depends(student_only)):
    return my_payments(session, user.id)                      # plain array (agreement exception)


@router.post("/payments/receipt", status_code=201)
def post_receipt(body: ReceiptIn, session: Session = Db, user: CurrentUser = Depends(student_only),
                 key: Optional[str] = Depends(idempotency_key)):
    return run_idempotent(session, user.id, key, "POST /payments/receipt",
                          lambda: submit_receipt(session, user.id, body))


# ---- digital card ------------------------------------------------------------------------------
@router.get("/card/me")
def get_my_card(session: Session = Db, lang: str = Depends(get_lang), user: CurrentUser = Depends(student_only)):
    return my_card(session, user.id, lang)


# ---- student requests --------------------------------------------------------------------------
# NOTE: static paths (/requests/me, /requests/refund-policy) are declared BEFORE /requests/{request_id}.
@router.get("/requests/me")
def get_my_requests(kind: Optional[str] = None, session: Session = Db, lang: str = Depends(get_lang),
                    user: CurrentUser = Depends(student_only)):
    return my_requests(session, user.id, kind, lang)          # plain array (agreement exception)


@router.get("/requests/refund-policy")
def get_refund_policy(session: Session = Db, user: CurrentUser = Depends(student_only)):
    return refund_policy(session, user.id)


@router.get("/requests/{request_id}")
def get_request(request_id: uuid.UUID, session: Session = Db, lang: str = Depends(get_lang),
                user: CurrentUser = Depends(student_only)):
    return get_my_request(session, user.id, request_id, lang)


@router.post("/requests/line-change", status_code=201)
def post_line_change(body: LineChangeIn, session: Session = Db, lang: str = Depends(get_lang),
                     user: CurrentUser = Depends(student_only), key: Optional[str] = Depends(idempotency_key)):
    return run_idempotent(session, user.id, key, "POST /requests/line-change",
                          lambda: create_line_change(session, user, body, lang))


@router.post("/requests/refund", status_code=201)
def post_refund(body: RefundIn, session: Session = Db, lang: str = Depends(get_lang),
                user: CurrentUser = Depends(student_only), key: Optional[str] = Depends(idempotency_key)):
    return run_idempotent(session, user.id, key, "POST /requests/refund",
                          lambda: create_refund(session, user, body, lang))


@router.post("/requests/complaint", status_code=201)
def post_complaint(body: ComplaintIn, session: Session = Db, lang: str = Depends(get_lang),
                   user: CurrentUser = Depends(student_only), key: Optional[str] = Depends(idempotency_key)):
    return run_idempotent(session, user.id, key, "POST /requests/complaint",
                          lambda: create_complaint(session, user, body, lang))


@router.post("/requests/{request_id}/withdraw")
def post_withdraw(request_id: uuid.UUID, session: Session = Db, lang: str = Depends(get_lang),
                  user: CurrentUser = Depends(student_only), key: Optional[str] = Depends(idempotency_key)):
    return run_idempotent(session, user.id, key, f"POST /requests/{request_id}/withdraw",
                          lambda: withdraw_request(session, user.id, request_id, lang))


# ---- parent approvals ----------------------------------------------------------------------------
@router.get("/parent/approvals")
def get_parent_approvals(session: Session = Db, lang: str = Depends(get_lang),
                         user: CurrentUser = Depends(parent_only)):
    return parent_approvals(session, user.id, lang)


@router.post("/parent/approvals/{request_id}/approve")
def post_parent_approve(request_id: uuid.UUID, body: GuardianDecisionIn = GuardianDecisionIn(),
                        session: Session = Db, lang: str = Depends(get_lang),
                        user: CurrentUser = Depends(parent_only), key: Optional[str] = Depends(idempotency_key)):
    return run_idempotent(session, user.id, key, f"POST /parent/approvals/{request_id}/approve",
                          lambda: parent_decide(session, user, request_id, True, body, lang))


@router.post("/parent/approvals/{request_id}/refuse")
def post_parent_refuse(request_id: uuid.UUID, body: GuardianDecisionIn = GuardianDecisionIn(),
                       session: Session = Db, lang: str = Depends(get_lang),
                       user: CurrentUser = Depends(parent_only), key: Optional[str] = Depends(idempotency_key)):
    return run_idempotent(session, user.id, key, f"POST /parent/approvals/{request_id}/refuse",
                          lambda: parent_decide(session, user, request_id, False, body, lang))


# ---- Finance office: payments ----------------------------------------------------------------------
@router.get("/admin/payments")
def get_admin_payments(status: Optional[str] = None, q: Optional[str] = None, page: int = Query(1, ge=1),
                       page_size: int = Query(20, ge=1, le=100), session: Session = Db,
                       user: CurrentUser = Depends(finance_office)):
    return admin_list_payments(session, status, q, page, page_size)


@router.get("/admin/payments/{payment_id}")
def get_admin_payment(payment_id: uuid.UUID, session: Session = Db, lang: str = Depends(get_lang),
                      user: CurrentUser = Depends(finance_office)):
    return admin_get_payment(session, payment_id, lang)


@router.patch("/admin/payments/{payment_id}")
def patch_admin_payment(payment_id: uuid.UUID, body: PaymentDecisionIn, session: Session = Db,
                        user: CurrentUser = Depends(finance_office)):
    return admin_decide_payment(session, user, payment_id, body)


@router.get("/admin/bookings/awaiting-payment")
def get_awaiting_booking(identifier: str, session: Session = Db, lang: str = Depends(get_lang),
                         user: CurrentUser = Depends(finance_office)):
    return admin_awaiting_booking(session, identifier, lang)


@router.post("/admin/payments/office", status_code=201)
def post_office_payment(body: OfficePaymentIn, session: Session = Db,
                        user: CurrentUser = Depends(finance_office)):
    return admin_office_payment(session, user, body)


# ---- office: requests queue ----------------------------------------------------------------------------
# NOTE: agreement shows `kind[]` in the query; FastAPI reads it as `kind` (repeat the key).
@router.get("/admin/requests")
def get_admin_requests(kind: list[str] = Query(default=[]), stage: Optional[str] = None, q: Optional[str] = None,
                       page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                       session: Session = Db, lang: str = Depends(get_lang),
                       user: CurrentUser = Depends(requests_office)):
    return admin_list_requests(session, user, kind, stage, q, page, page_size, lang)


@router.get("/admin/requests/{request_id}")
def get_admin_request(request_id: uuid.UUID, session: Session = Db, lang: str = Depends(get_lang),
                      user: CurrentUser = Depends(requests_office)):
    return admin_get_request(session, user, request_id, lang)


@router.patch("/admin/requests/{request_id}")
def patch_admin_request(request_id: uuid.UUID, body: RequestActionIn, session: Session = Db,
                        lang: str = Depends(get_lang), user: CurrentUser = Depends(requests_office)):
    return admin_act_on_request(session, user, request_id, body, lang)


# ==========================================
# TODO: INTEGRATION NOTES
# ==========================================
# 1. أولاً: قسّم الملف على app/modules/subscriptions/ و payments/ و card/ زي ما موضح في أول الملف
#    (مهم: verify_card_token لازم يفضل في app.modules.card.service لأن محمد نبيل بيستدعيه).
#
# 2. في جدول subscriptions:
#    - ربط الحقل student_id بـ ForeignKey لجدول users.id عند (محمود / محمد علي)
#    - ربط الحقل line_id بـ ForeignKey لجدول lines.id عند (محمد نبيل)
#    - ربط الحقل stop_id بـ ForeignKey لجدول stops.id عند (محمد نبيل)
#    - (term_id متربط فعلاً بـ terms في نفس الملف)
#
# 3. في جدول payments:
#    - ربط student_id و reviewed_by بـ ForeignKey لجدول users.id عند (محمود / محمد علي)
#    - (subscription_id متربط فعلاً بـ subscriptions عندي)
#
# 4. في جدول requests / request_events:
#    - ربط student_id و guardian_user_id و handled_by و request_events.actor_user_id بـ users.id
#    - ربط target_line_id و line_id بـ lines.id، و target_stop_id بـ stops.id عند (محمد نبيل)
#    - (subscription_id متربط فعلاً بـ subscriptions عندي)
#
# 5. الاستعلامات المباشرة (SQL) على جداول حد تاني - تستبدل بدوال الـ service بتاعتهم وقت الدمج:
#    - lines(id, code, ar_name, en_name, price_piasters, total_seats, is_active) و stops(id, line_id,
#      ar_name, en_name)  -> عند محمد نبيل (line_info / stop_info). السعر والمقاعد جايين من lines.
#    - users(id, name, identifier, phone) -> عند محمود / محمد علي (user_basic / user_by_identifier).
#    - guardians(student_id, guardian_user_id) -> عند محمد علي (guardian_user_for). لو ولي الأمر
#      معندوش حساب بيرجع None وطلب تغيير الخط بيروح للمكتب على طول (submitted).
#
# 6. محمود (المصادقة والأمان):
#    - استبدال get_current_user و CurrentUser بالـ dependency بتاعته (أدوار: student / parent /
#      finance / transport_admin / super_admin).
#    - مراجعة أمان الـ QR: مفتاح Ed25519 بيجي من متغير البيئة CARD_ED25519_PRIVATE_KEY
#      (base64 لـ 32 byte)؛ من غيره بيتعمل مفتاح مؤقت للتجربة بس. محتاجين اتفاق على حفظ المفتاح وتدويره،
#      ومعاه فحص magic bytes للملفات المرفوعة.
#
# 7. محمد نبيل (التشغيل): get_effective_line(session, student_id, date) هنا هو اللي بيحدد خط الطالب مع
#    التغيير المؤقت، يستخدمه في الرحلة الجاية / كشف الركاب / التتبع بدل student_active_line_id.
#    تغيير الخط الدايم بيتطبق على subscriptions.line_id/stop_id (apply_line_change).
#
# 8. محمد علي (الأساس):
#    - تسجيل الـ router وتسطيح الأخطاء {"code","message"}.
#    - record_audit بيستدعي app.common.audit.write_audit؛ عدّل الاسم لو مختلف.
#    - request_reference_seq (Sequence) لازم يدخل في الـ migration مع كل الجداول والـ Enums.
#    - subs_idempotency_keys ممكن تتحول لجدول مشترك مع ops_idempotency_keys.
#    - جدولة (scheduler): expire_stale_holds كل 5 دقايق، و apply_due_line_changes يومياً.
#
# 9. أسئلة لسه مفتوحة في الاتفاق: مهلة الـ 24 ساعة (أيام شغل ولا 48 ساعة)، تخزين الملفات (دومين
#    الـ signed links)، 64base ولا multipart، خصم 9-10 و30-31 أكتوبر (متحط الصف الأشد لحد تأكيد
#    المالية)، تصريح المجسم (model_permit) مش متنفذ لأن الحقول لسه ما اتحددتش، بيانات البنك
#    (payment_settings) فاضية لحد ما المالية تبعتها.
#
# 10. الإشعارات (لسه من غير مالك): emit_event مجرد logging دلوقتي. الأحداث: payment_approved /
#     payment_rejected / request_update / needed_approval.
