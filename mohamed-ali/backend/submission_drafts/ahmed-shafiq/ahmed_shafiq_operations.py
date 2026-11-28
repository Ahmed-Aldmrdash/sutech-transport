
"""
==============================================================================
Ahmed shafiq's task  ->  app/modules/operations/
Lines, stops, buses, drivers, timetable, trips, attendance, absences,
live bus tracking and transport-office operations.
==============================================================================

HOW THIS FILE IS ORGANISED (one file for hand-in; split it like this when merging):
    app/modules/operations/models.py    -> section 2  (tables)
    app/modules/operations/schemas.py   -> section 3  (pydantic in/out)
    app/modules/operations/service.py   -> section 4  (business rules)
    app/modules/operations/router.py    -> section 5  (HTTP endpoints, `router`)

TEAM RULES FOLLOWED (from the doctor + CONTRIBUTING.md):
  * snake_case everywhere, UUID primary keys, TIMESTAMPTZ in UTC.
  * Money = integer piasters (BigInteger).
  * Shared `Base` from app/db/base.py and `get_db_session` from app/db/session.py.
  * Fields that point at another owner's table are plain UUID(as_uuid=True) +
    index=True  (NO ForeignKey).  Foreign keys are used only between tables
    that live in THIS module.
  * Services own their transaction and commit explicitly.
  * No Alembic revision, no edit of app/api/v1/router.py (Muhammad Ali registers `router`).
  * Day-of-service times ("07:40") are Africa/Cairo wall-clock `Time` columns,
    exactly as the front/back agreement says; real instants are TIMESTAMPTZ (UTC).

ASSUMPTIONS (change in 2 minutes if the foundation PR differs):
  * Sync SQLAlchemy 2.0 `Session` from `get_db_session`.
  * Auth is Mahmoud's.  Until it is merged, `get_current_user` below raises 501;
    at integration, point it at Mahmoud's dependency (or use
    app.dependency_overrides[get_current_user] = <his dependency>).
  * Errors are raised as HTTPException(detail={"code": "...", "message": "..."}).
    Muhammad Ali's shared handler should flatten that to {"code","message"}.
"""
import enum
import logging
import uuid
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import Callable, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
    bindparam,
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
# 1. Constants & small helpers
# =============================================================================
CAIRO = ZoneInfo("Africa/Cairo")
UTC = timezone.utc

SERVICE_WEEKDAYS = {6, 0, 1, 2, 3}          # Sun, Mon, Tue, Wed, Thu (python: Mon=0)
DEFAULT_RETURN_TIME = time(16, 30)           # all buses leave campus 16:30 (13 Nov)
DEFAULT_ARRIVAL = (time(8, 30), time(8, 30))  # arrival at campus 08:30
RETURN_TIME_MIN, RETURN_TIME_MAX = time(12, 0), time(20, 0)   # confirmed by Ahmed
FALLBACK_FIRST_PICKUP = time(7, 0)           # only if a line has no pickup times yet
ABSENCE_HORIZON_DAYS = 7
DELAY_WINDOW = timedelta(minutes=60)
ALLOWED_DELAY_MINUTES = {5, 10, 15, 20, 30, 45, 60}
SEATS_BY_BUS_TYPE = {"minibus": 14, "coaster": 28, "midibus": 33, "large_bus": 50}

CREW_ROLES = ("driver", "supervisor")
OFFICE_ROLES = ("transport_admin", "super_admin")


def utcnow() -> datetime:
    return datetime.now(UTC)


def cairo_today() -> date:
    return datetime.now(CAIRO).date()


def at_cairo(d: date, t: time) -> datetime:
    """Cairo wall-clock date+time -> aware UTC datetime."""
    return datetime.combine(d, t, tzinfo=CAIRO).astimezone(UTC)


def is_service_day(d: date) -> bool:
    return d.weekday() in SERVICE_WEEKDAYS


def hhmm(t: Optional[time]) -> Optional[str]:
    return t.strftime("%H:%M") if t else None


def pick_lang(lang: str, ar: Optional[str], en: Optional[str]) -> Optional[str]:
    return (en or ar) if lang == "en" else (ar or en)


def err(status: int, code: str, message: str = "") -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "message": message or code})


def pg_enum(py_enum: type[enum.Enum], name: str) -> Enum:
    """Store the enum *values* (snake_case strings) in Postgres."""
    return Enum(py_enum, name=name, values_callable=lambda e: [m.value for m in e])


def emit_event(session: Session, event_type: str, payload: dict) -> None:
    """Hook for notifications / WebSocket fan-out (owner not assigned yet).
    TODO: replace with the notifications service once an owner exists."""
    log.info("event %s %s", event_type, payload)


def record_audit(session: Session, actor_id: uuid.UUID, action: str, area: str,
                 target: str, detail: str = "") -> None:
    """Writes into Muhammad Ali's audit log in the SAME transaction as the decision.
    TODO: call app.common.audit (or his audit service) when merged."""
    try:
        from app.common.audit import write_audit  # type: ignore
        write_audit(session, actor_id=actor_id, action=action, area=area,
                    target=target, detail=detail)
    except ImportError:
        log.info("audit %s %s %s %s", action, area, target, detail)


# =============================================================================
# 2. MODELS
# =============================================================================
class BusOwner(str, enum.Enum):
    university = "university"
    abu_el_hol = "abu_el_hol"


class BusType(str, enum.Enum):
    minibus = "minibus"
    coaster = "coaster"
    midibus = "midibus"
    large_bus = "large_bus"


class TripDirection(str, enum.Enum):
    outbound = "outbound"
    return_trip = "return"


class TripStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    ended = "ended"


class RiderState(str, enum.Enum):
    waiting = "waiting"
    boarded = "boarded"
    checked_out = "checked_out"
    not_going = "not_going"
    absent = "absent"


class CheckoutReason(str, enum.Enum):
    unwell = "unwell"
    guardian_pickup = "guardian_pickup"
    personal = "personal"
    other = "other"


class ScanMethod(str, enum.Enum):
    qr = "qr"
    manual = "manual"


class AbsenceReason(str, enum.Enum):
    sick = "sick"
    no_lectures = "no_lectures"
    personal = "personal"
    other = "other"


class AbsenceStatus(str, enum.Enum):
    active = "active"
    cancelled = "cancelled"


class DelayReason(str, enum.Enum):
    traffic = "traffic"
    breakdown = "breakdown"
    weather = "weather"
    closed_road = "closed_road"
    other = "other"


class ReplacementReason(str, enum.Enum):
    breakdown = "breakdown"
    accident = "accident"
    driver_unavailable = "driver_unavailable"
    other = "other"


class Line(Base):
    __tablename__ = "lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)   # "5", "2-14"
    ar_name: Mapped[str] = mapped_column(String(255), nullable=False)
    en_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # money = integer piasters in BigInteger (1,500 EGP = 150000)
    price_piasters: Mapped[int] = mapped_column(BigInteger, nullable=False, default=1_500_000)
    bus_type: Mapped[Optional[BusType]] = mapped_column(pg_enum(BusType, "bus_type"), nullable=True)
    total_seats: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    arrival_campus_from: Mapped[time] = mapped_column(Time, nullable=False, default=DEFAULT_ARRIVAL[0])
    arrival_campus_to: Mapped[time] = mapped_column(Time, nullable=False, default=DEFAULT_ARRIVAL[1])
    # NULL = use DEFAULT_RETURN_TIME (16:30)
    return_departure_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    stops: Mapped[list["Stop"]] = relationship(back_populates="line", order_by="Stop.stop_order",
                                               cascade="all, delete-orphan")


class Stop(Base):
    __tablename__ = "stops"
    __table_args__ = (UniqueConstraint("line_id", "stop_order", name="uq_stops_line_order"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    line_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lines.id"), nullable=False, index=True)
    ar_name: Mapped[str] = mapped_column(String(255), nullable=False)
    en_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    stop_order: Mapped[int] = mapped_column(Integer, nullable=False)
    pickup_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)   # Cairo wall-clock
    # Plain lat/lng until the office sends real coordinates.
    # TODO(PostGIS): the geo owner may later swap these for a `Point` column.
    lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)           # "أمام لولو ماركت"

    line: Mapped["Line"] = relationship(back_populates="stops")


class Driver(Base):
    __tablename__ = "drivers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # login account (users table is Mahmoud / Muhammad Ali's) -> no FK
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone_number: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    license_number: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)


class Bus(Base):
    __tablename__ = "buses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plate_number: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    bus_code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    bus_type: Mapped[BusType] = mapped_column(pg_enum(BusType, "bus_type"), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    owner: Mapped[BusOwner] = mapped_column(pg_enum(BusOwner, "bus_owner"), nullable=False, index=True)
    default_driver_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drivers.id"), nullable=True, index=True)
    is_spare: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false", index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    default_driver: Mapped[Optional["Driver"]] = relationship()


class LineAssignment(Base):
    """Which bus / driver / supervisor normally serves a line (a line may have 2 buses)."""
    __tablename__ = "line_assignments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    line_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lines.id"), nullable=False, index=True)
    bus_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("buses.id"), nullable=False, index=True)
    driver_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("drivers.id"), nullable=True, index=True)
    supervisor_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)  # users (no FK)
    starts_on: Mapped[date] = mapped_column(Date, nullable=False, default=cairo_today)
    ends_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class Trip(Base):
    __tablename__ = "trips"
    __table_args__ = (
        UniqueConstraint("line_id", "bus_id", "direction", "service_date", name="uq_trips_line_bus_dir_date"),
        Index("ix_trips_service_date_status", "service_date", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    line_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lines.id"), nullable=False, index=True)
    bus_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("buses.id"), nullable=False, index=True)
    driver_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("drivers.id"), nullable=True, index=True)
    supervisor_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    direction: Mapped[TripDirection] = mapped_column(pg_enum(TripDirection, "trip_direction"), nullable=False)
    service_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[TripStatus] = mapped_column(pg_enum(TripStatus, "trip_status"), nullable=False,
                                               default=TripStatus.not_started, index=True)
    departure_time: Mapped[time] = mapped_column(Time, nullable=False)          # Cairo wall-clock
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    line: Mapped["Line"] = relationship()
    bus: Mapped["Bus"] = relationship()
    driver: Mapped[Optional["Driver"]] = relationship()


class TripRider(Base):
    """One row per subscribed student per trip = the roster AND the attendance record."""
    __tablename__ = "trip_riders"
    __table_args__ = (UniqueConstraint("trip_id", "student_id", name="uq_trip_riders_trip_student"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)   # users (no FK)
    stop_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("stops.id"), nullable=True)
    state: Mapped[RiderState] = mapped_column(pg_enum(RiderState, "rider_state"), nullable=False,
                                              default=RiderState.waiting, index=True)
    boarded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    arrived_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    checked_out_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    checkout_reason: Mapped[Optional[CheckoutReason]] = mapped_column(pg_enum(CheckoutReason, "checkout_reason"), nullable=True)
    checkout_note: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    scan_method: Mapped[Optional[ScanMethod]] = mapped_column(pg_enum(ScanMethod, "scan_method"), nullable=True)
    scanned_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    going_not_reason: Mapped[Optional[AbsenceReason]] = mapped_column(pg_enum(AbsenceReason, "absence_reason"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)


class TripDelay(Base):
    __tablename__ = "trip_delays"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=False, index=True)
    minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[DelayReason] = mapped_column(pg_enum(DelayReason, "delay_reason"), nullable=False)
    note: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    reported_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)   # users (no FK)
    reported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, index=True)


class TripReplacement(Base):
    """Bus / driver swap on ONE day's trip.  Riders & attendance stay on the same trip_id."""
    __tablename__ = "trip_replacements"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=False, index=True)
    old_bus_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("buses.id"), nullable=False)
    new_bus_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("buses.id"), nullable=False)
    old_driver_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("drivers.id"), nullable=True, index=True)
    new_driver_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("drivers.id"), nullable=True)
    reason: Mapped[ReplacementReason] = mapped_column(pg_enum(ReplacementReason, "replacement_reason"), nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sos_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)   # sos_alerts (other owner)
    by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class Absence(Base):
    """'مش هروح' - a student reports a whole service day (both trips)."""
    __tablename__ = "absences"
    __table_args__ = (
        Index("uq_absences_active_student_day", "student_id", "service_date", unique=True,
              postgresql_where=text("status = 'active'")),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)   # users (no FK)
    service_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    reason: Mapped[AbsenceReason] = mapped_column(pg_enum(AbsenceReason, "absence_reason"), nullable=False)
    note: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    cutoff_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[AbsenceStatus] = mapped_column(pg_enum(AbsenceStatus, "absence_status"), nullable=False,
                                                  default=AbsenceStatus.active, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class BusLivePosition(Base):
    """Latest known position per bus (read side for live tracking).
    The GPS *ingest* + history table (trip_locations) belong to Mahmoud / the geo owner;
    they upsert into this table (or we read their table - see TODO notes)."""
    __tablename__ = "bus_live_positions"

    bus_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("buses.id"), primary_key=True)
    trip_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=True, index=True)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    heading: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    speed_kmh: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, index=True)


class OpsIdempotencyKey(Base):
    """Replays the stored response when the same Idempotency-Key is sent twice.
    TODO: Muhammad Ali may replace this with one shared table in app/common."""
    __tablename__ = "ops_idempotency_keys"
    __table_args__ = (UniqueConstraint("user_id", "key", "endpoint", name="uq_ops_idem_user_key_endpoint"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    endpoint: Mapped[str] = mapped_column(String(120), nullable=False)
    response_body: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


# =============================================================================
# 3. SCHEMAS
# =============================================================================
class LocationOut(BaseModel):
    lat: float
    lng: float


class StopOut(BaseModel):
    id: str
    name: str
    ar_name: str
    en_name: Optional[str] = None
    order: int
    pickup_time: Optional[str] = None
    location: Optional[LocationOut] = None
    note: Optional[str] = None


class ArrivalCampusOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    from_: str = Field(alias="from")
    to: str


class LineOut(BaseModel):
    id: str
    code: str
    name: str
    ar_name: str
    en_name: Optional[str] = None
    price_piasters: int
    bus_type: Optional[str] = None
    total_seats: int
    available_seats: int
    first_pickup_time: Optional[str] = None
    arrival_campus: ArrivalCampusOut
    time_departure_return: str
    stops: list[StopOut]


class DriverContactOut(BaseModel):
    name: str
    phone: Optional[str] = None


class LineBusOut(BaseModel):
    bus_type: Optional[str] = None
    plate: Optional[str] = None
    driver: Optional[DriverContactOut] = None


class LineDetailOut(LineOut):
    bus: Optional[LineBusOut] = None


# ---- admin inputs
class StopIn(BaseModel):
    ar_name: str = Field(min_length=1, max_length=255)
    en_name: Optional[str] = Field(default=None, max_length=255)
    order: int = Field(ge=1)
    pickup_time: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    lat: Optional[float] = None
    lng: Optional[float] = None
    note: Optional[str] = None


class LineCreate(BaseModel):
    code: str = Field(min_length=1, max_length=20)
    ar_name: str
    en_name: Optional[str] = None
    price_piasters: int = Field(default=1_500_000, ge=0)
    bus_type: Optional[BusType] = None
    total_seats: int = Field(default=0, ge=0)
    stops: list[StopIn] = []


class LineUpdate(BaseModel):
    ar_name: Optional[str] = None
    en_name: Optional[str] = None
    price_piasters: Optional[int] = Field(default=None, ge=0)
    bus_type: Optional[BusType] = None
    total_seats: Optional[int] = Field(default=None, ge=0)
    is_active: Optional[bool] = None
    stops: Optional[list[StopIn]] = None        # replaces the stop list when sent


class DriverIn(BaseModel):
    full_name: str
    phone_number: str
    license_number: str
    user_id: Optional[uuid.UUID] = None


class DriverUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    license_number: Optional[str] = None
    user_id: Optional[uuid.UUID] = None
    is_active: Optional[bool] = None


class BusIn(BaseModel):
    plate_number: str
    bus_code: str
    bus_type: BusType
    capacity: Optional[int] = Field(default=None, ge=1)
    owner: BusOwner
    default_driver_id: Optional[uuid.UUID] = None
    is_spare: bool = False


class BusUpdate(BaseModel):
    plate_number: Optional[str] = None
    bus_type: Optional[BusType] = None
    capacity: Optional[int] = Field(default=None, ge=1)
    owner: Optional[BusOwner] = None
    default_driver_id: Optional[uuid.UUID] = None
    is_spare: Optional[bool] = None
    is_active: Optional[bool] = None


class AssignmentIn(BaseModel):
    line_id: uuid.UUID
    bus_id: uuid.UUID
    driver_id: Optional[uuid.UUID] = None
    supervisor_user_id: Optional[uuid.UUID] = None
    starts_on: Optional[date] = None


class ReturnTimeIn(BaseModel):
    line_ids: list[uuid.UUID] = []                 # empty = all lines
    return_departure_time: str = Field(pattern=r"^\d{2}:\d{2}$")


# ---- crew inputs
class DelayIn(BaseModel):
    minutes: int
    reason: DelayReason
    note: Optional[str] = Field(default=None, max_length=200)


class ScanIn(BaseModel):
    action: str = Field(pattern="^(board|checkout)$")
    method: ScanMethod
    qr_token: Optional[str] = None
    identifier: Optional[str] = None
    reason: Optional[CheckoutReason] = None
    note: Optional[str] = Field(default=None, max_length=200)


class ReplacementIn(BaseModel):
    bus_id: Optional[uuid.UUID] = None
    driver_id: Optional[uuid.UUID] = None
    reason: ReplacementReason
    note: Optional[str] = None
    sos_id: Optional[uuid.UUID] = None


# ---- student inputs
class AbsenceIn(BaseModel):
    service_date: date
    reason: AbsenceReason
    note: Optional[str] = Field(default=None, max_length=300)


# =============================================================================
# 4. SERVICE  (business rules)
# =============================================================================
@dataclass
class CurrentUser:
    id: uuid.UUID
    role: str
    name: str = ""


def get_current_user() -> CurrentUser:
    """PLACEHOLDER - Mahmoud owns auth.  Override with his dependency at integration."""
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
    """Run `fn` once per (user, key, endpoint); the 2nd call gets the stored response."""
    if not key:
        return fn()
    found = session.scalar(select(OpsIdempotencyKey).where(
        OpsIdempotencyKey.user_id == user_id, OpsIdempotencyKey.key == key,
        OpsIdempotencyKey.endpoint == endpoint))
    if found:
        return found.response_body
    result = jsonable_encoder(fn())
    try:
        session.add(OpsIdempotencyKey(user_id=user_id, key=key, endpoint=endpoint, response_body=result))
        session.commit()
    except IntegrityError:           # concurrent duplicate
        session.rollback()
        found = session.scalar(select(OpsIdempotencyKey).where(
            OpsIdempotencyKey.user_id == user_id, OpsIdempotencyKey.key == key,
            OpsIdempotencyKey.endpoint == endpoint))
        if found:
            return found.response_body
    return result


# ---- cross-module reads (tables owned by Ahmed / Mahmoud) -------------------
# Plain SQL on purpose: no import of other owners' models, no ForeignKey.
# TODO(integration): replace each with the owner's service function once merged.
def seats_used_by_line(session: Session, line_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not line_ids:
        return {}
    stmt = text("SELECT line_id, count(*) AS n FROM subscriptions "
                "WHERE status IN ('reserved','review_payment','active') AND line_id IN :ids "
                "GROUP BY line_id").bindparams(bindparam("ids", expanding=True))
    return {r.line_id: r.n for r in session.execute(stmt, {"ids": line_ids})}


def student_active_line_id(session: Session, student_id: uuid.UUID) -> Optional[uuid.UUID]:
    # TODO: honour approved temporary line changes (Ahmed's `get_effective_line`).
    return session.scalar(text(
        "SELECT line_id FROM subscriptions WHERE student_id = :s AND status = 'active' "
        "ORDER BY activated_at DESC NULLS LAST LIMIT 1"), {"s": student_id})


def active_subscribers(session: Session, line_id: uuid.UUID):
    return session.execute(text(
        "SELECT student_id, stop_id, activated_at FROM subscriptions "
        "WHERE line_id = :l AND status = 'active'"), {"l": line_id}).all()


def user_is_subscriber_of_line(session: Session, user_id: uuid.UUID, line_id: uuid.UUID) -> bool:
    return bool(session.scalar(text(
        "SELECT 1 FROM subscriptions WHERE student_id = :u AND line_id = :l AND status = 'active' LIMIT 1"),
        {"u": user_id, "l": line_id}))


def student_by_identifier(session: Session, identifier: str) -> Optional[uuid.UUID]:
    return session.scalar(text("SELECT id FROM users WHERE identifier = :i LIMIT 1"), {"i": identifier.strip()})


def student_display(session: Session, student_id: uuid.UUID) -> tuple[str, str]:
    row = session.execute(text("SELECT name, identifier FROM users WHERE id = :i"), {"i": student_id}).first()
    return (row.name, row.identifier) if row else ("", "")


def has_open_sos(session: Session, trip_id: uuid.UUID) -> bool:
    # sos_alerts belongs to another owner; assumed columns trip_id/status.
    try:
        return bool(session.scalar(text(
            "SELECT 1 FROM sos_alerts WHERE trip_id = :t AND status <> 'closed' LIMIT 1"), {"t": trip_id}))
    except Exception:    # table not there yet
        session.rollback()
        return False


# ---- lines ------------------------------------------------------------------
def first_pickup_time(line: Line) -> Optional[time]:
    times = [s.pickup_time for s in line.stops if s.pickup_time]
    return min(times) if times else None


def line_to_out(line: Line, lang: str, used: int) -> dict:
    return {
        "id": str(line.id), "code": line.code,
        "name": pick_lang(lang, line.ar_name, line.en_name),
        "ar_name": line.ar_name, "en_name": line.en_name,
        "price_piasters": line.price_piasters,
        "bus_type": line.bus_type.value if line.bus_type else None,
        "total_seats": line.total_seats,
        "available_seats": max(line.total_seats - used, 0),
        "first_pickup_time": hhmm(first_pickup_time(line)),
        "arrival_campus": {"from": hhmm(line.arrival_campus_from), "to": hhmm(line.arrival_campus_to)},
        "time_departure_return": hhmm(line.return_departure_time or DEFAULT_RETURN_TIME),
        "stops": [{
            "id": str(s.id), "name": pick_lang(lang, s.ar_name, s.en_name), "ar_name": s.ar_name,
            "en_name": s.en_name, "order": s.stop_order, "pickup_time": hhmm(s.pickup_time),
            "location": {"lat": s.lat, "lng": s.lng} if s.lat is not None and s.lng is not None else None,
            "note": s.note,
        } for s in line.stops],
    }


def list_lines(session: Session, lang: str) -> list[dict]:
    lines = session.scalars(select(Line).where(Line.is_active.is_(True)).order_by(Line.code)).all()
    used = seats_used_by_line(session, [l.id for l in lines])
    return [line_to_out(l, lang, used.get(l.id, 0)) for l in lines]


def _get_line(session: Session, line_id: uuid.UUID) -> Line:
    line = session.get(Line, line_id)
    if not line:
        raise err(404, "LINE_NOT_FOUND", "Line not found")
    return line


def line_detail(session: Session, user: CurrentUser, line_id: uuid.UUID, lang: str) -> dict:
    line = _get_line(session, line_id)
    out = line_to_out(line, lang, seats_used_by_line(session, [line.id]).get(line.id, 0))
    a = session.scalar(select(LineAssignment).where(LineAssignment.line_id == line.id,
                                                    LineAssignment.is_active.is_(True)).limit(1))
    bus = None
    if a:
        b, d = session.get(Bus, a.bus_id), (session.get(Driver, a.driver_id) if a.driver_id else None)
        # driver phone only for subscribers of this line (and staff); parents: TODO via guardians
        show_phone = user.role in OFFICE_ROLES + CREW_ROLES or user_is_subscriber_of_line(session, user.id, line.id)
        bus = {"bus_type": b.bus_type.value if b else None, "plate": b.plate_number if b else None,
               "driver": {"name": d.full_name, "phone": d.phone_number if show_phone else None} if d else None}
    out["bus"] = bus
    return out


# ---- trips ------------------------------------------------------------------
def _build_roster(session: Session, trip: Trip) -> None:
    dep_utc = at_cairo(trip.service_date, trip.departure_time)
    stops = {s.id for s in session.scalars(select(Stop).where(Stop.line_id == trip.line_id))}
    away = {a.student_id: a for a in session.scalars(select(Absence).where(
        Absence.service_date == trip.service_date, Absence.status == AbsenceStatus.active))}
    for r in active_subscribers(session, trip.line_id):
        # rule: no history before activation - a student activated after this trip left has no row
        if r.activated_at and r.activated_at >= dep_utc:
            continue
        ab = away.get(r.student_id)
        session.add(TripRider(
            trip_id=trip.id, student_id=r.student_id, stop_id=r.stop_id if r.stop_id in stops else None,
            state=RiderState.not_going if ab else RiderState.waiting,
            going_not_reason=ab.reason if ab else None))


def ensure_trips_for_date(session: Session, service_date: date) -> None:
    """Creates the day's outbound + return trips (with rosters) from line assignments.
    Safe to call repeatedly; also meant for a nightly scheduler (TODO: wire a job)."""
    if not is_service_day(service_date):
        return
    assignments = session.scalars(select(LineAssignment).where(
        LineAssignment.is_active.is_(True), LineAssignment.starts_on <= service_date,
        or_(LineAssignment.ends_on.is_(None), LineAssignment.ends_on >= service_date))).all()
    for a in assignments:
        line = session.get(Line, a.line_id)
        if not line or not line.is_active:
            continue
        for direction, dep in ((TripDirection.outbound, first_pickup_time(line) or FALLBACK_FIRST_PICKUP),
                               (TripDirection.return_trip, line.return_departure_time or DEFAULT_RETURN_TIME)):
            exists = session.scalar(select(Trip.id).where(
                Trip.line_id == a.line_id, Trip.bus_id == a.bus_id,
                Trip.direction == direction, Trip.service_date == service_date))
            if exists:
                continue
            trip = Trip(line_id=a.line_id, bus_id=a.bus_id, driver_id=a.driver_id,
                        supervisor_user_id=a.supervisor_user_id, direction=direction,
                        service_date=service_date, departure_time=dep)
            session.add(trip)
            session.flush()
            _build_roster(session, trip)
    session.commit()


def _trip_or_404(session: Session, trip_id: uuid.UUID) -> Trip:
    trip = session.get(Trip, trip_id)
    if not trip:
        raise err(404, "NOT_FOUND", "Trip not found")
    return trip


def _assert_crew_of_trip(session: Session, user: CurrentUser, trip: Trip) -> None:
    me_driver = session.scalar(select(Driver.id).where(Driver.user_id == user.id))
    if user.role == "driver" and me_driver and me_driver == trip.driver_id:
        return
    if user.role == "supervisor" and trip.supervisor_user_id == user.id:
        return
    # a driver who was swapped out of this trip gets a specific error
    if user.role == "driver" and me_driver and session.scalar(select(TripReplacement.id).where(
            TripReplacement.trip_id == trip.id, TripReplacement.old_driver_id == me_driver)):
        raise err(403, "RELIEVED_DRIVER", "You were replaced on this trip")
    raise err(403, "NOT_YOUR_TRIP", "This trip is not assigned to you")


def _counts(session: Session, trip_id: uuid.UUID) -> dict:
    rows = dict(session.execute(select(TripRider.state, func.count()).where(
        TripRider.trip_id == trip_id).group_by(TripRider.state)).all())
    g = lambda s: rows.get(s, 0)       # noqa: E731
    return {"total": sum(rows.values()), "waiting": g(RiderState.waiting), "boarded": g(RiderState.boarded),
            "checked_out": g(RiderState.checked_out), "not_going": g(RiderState.not_going),
            "absent": g(RiderState.absent)}


def _rider_out(session: Session, r: TripRider, stops: dict) -> dict:
    name, ident = student_display(session, r.student_id)
    stop = stops.get(r.stop_id)
    return {"student_id": str(r.student_id), "name": name, "identifier": ident,
            "stop_order": stop.stop_order if stop else None, "stop_name": stop.ar_name if stop else None,
            "pickup_time": hhmm(stop.pickup_time) if stop else None, "state": r.state.value,
            "boarded_at": r.boarded_at, "checked_out_at": r.checked_out_at,
            "checkout_reason": r.checkout_reason.value if r.checkout_reason else None,
            "checkout_note": r.checkout_note,
            "scan_method": r.scan_method.value if r.scan_method else None,
            "reason_going_not": r.going_not_reason.value if r.going_not_reason else None}


def riders_of_trip(session: Session, trip: Trip) -> list[dict]:
    stops = {s.id: s for s in session.scalars(select(Stop).where(Stop.line_id == trip.line_id))}
    rows = session.scalars(select(TripRider).where(TripRider.trip_id == trip.id)).all()
    rows.sort(key=lambda r: (stops[r.stop_id].stop_order if r.stop_id in stops else 10_000))
    return [_rider_out(session, r, stops) for r in rows]


def _trip_out(session: Session, trip: Trip) -> dict:
    last_delay = session.scalar(select(TripDelay).where(TripDelay.trip_id == trip.id)
                                .order_by(TripDelay.reported_at.desc()).limit(1))
    delays = session.scalars(select(TripDelay).where(TripDelay.trip_id == trip.id)
                             .order_by(TripDelay.reported_at)).all()
    return {"trip_id": str(trip.id), "direction": trip.direction.value, "status": trip.status.value,
            "departure_time": hhmm(trip.departure_time), "started_at": trip.started_at,
            "ended_at": trip.ended_at, "counts": _counts(session, trip.id),
            "riders": riders_of_trip(session, trip),
            "delays": [{"delay_id": str(d.id), "minutes": d.minutes, "reason": d.reason.value,
                        "note": d.note, "reported_at": d.reported_at} for d in delays],
            "sos": None,                       # TODO: latest SOS on this trip (SOS owner)
            "last_delay_minutes": last_delay.minutes if last_delay else None}


def crew_today(session: Session, user: CurrentUser, lang: str) -> dict:
    today = cairo_today()
    ensure_trips_for_date(session, today)
    me_driver = session.scalar(select(Driver.id).where(Driver.user_id == user.id))
    cond = (Trip.driver_id == me_driver) if user.role == "driver" and me_driver else \
           (Trip.supervisor_user_id == user.id)
    trips = session.scalars(select(Trip).where(Trip.service_date == today, cond)
                            .order_by(Trip.direction.desc())).all()
    if not trips:
        # previously relieved driver? tell them who took over
        if user.role == "driver" and me_driver:
            rep = session.scalar(select(TripReplacement).join(Trip, Trip.id == TripReplacement.trip_id).where(
                TripReplacement.old_driver_id == me_driver, Trip.service_date == today)
                .order_by(TripReplacement.created_at.desc()).limit(1))
            if rep:
                nd = session.get(Driver, rep.new_driver_id) if rep.new_driver_id else None
                return {"service_date": today, "is_service_day": is_service_day(today), "crew_role": user.role,
                        "relieved": {"driver_name": nd.full_name if nd else None,
                                     "driver_phone": nd.phone_number if nd else None, "at": rep.created_at},
                        "trips": []}
        raise err(404, "NO_ASSIGNMENT", "No line assigned to you today")
    line = session.get(Line, trips[0].line_id)
    bus = session.get(Bus, trips[0].bus_id)
    return {"service_date": today, "is_service_day": is_service_day(today), "crew_role": user.role,
            "line": {"id": str(line.id), "code": line.code, "name": pick_lang(lang, line.ar_name, line.en_name)},
            "bus": {"bus_id": str(bus.id), "bus_type": bus.bus_type.value, "plate": bus.plate_number,
                    "seats": bus.capacity},
            "stops": [{"name": pick_lang(lang, s.ar_name, s.en_name), "order": s.stop_order,
                       "pickup_time": hhmm(s.pickup_time)} for s in line.stops],
            "arrival_campus": {"from": hhmm(line.arrival_campus_from), "to": hhmm(line.arrival_campus_to)},
            "relieved": None, "trips": [_trip_out(session, t) for t in trips]}


def start_trip(session: Session, user: CurrentUser, trip_id: uuid.UUID) -> dict:
    trip = _trip_or_404(session, trip_id)
    _assert_crew_of_trip(session, user, trip)
    if trip.status == TripStatus.ended:
        raise err(409, "TRIP_ALREADY_ENDED")
    if trip.status == TripStatus.in_progress:
        raise err(409, "TRIP_ALREADY_STARTED")
    other = session.scalar(select(Trip.id).where(
        Trip.service_date == trip.service_date, Trip.status == TripStatus.in_progress,
        or_(Trip.driver_id == trip.driver_id, Trip.supervisor_user_id == trip.supervisor_user_id)))
    if other:
        raise err(409, "OTHER_TRIP_IN_PROGRESS")
    trip.status, trip.started_at = TripStatus.in_progress, utcnow()
    session.commit()
    emit_event(session, "status.trip", {"trip_id": str(trip.id), "status": "started"})
    return _trip_out(session, trip)


def end_trip(session: Session, user: CurrentUser, trip_id: uuid.UUID) -> dict:
    trip = _trip_or_404(session, trip_id)
    _assert_crew_of_trip(session, user, trip)
    if trip.status == TripStatus.ended:
        raise err(409, "TRIP_ALREADY_ENDED")
    if trip.status != TripStatus.in_progress:
        raise err(409, "TRIP_NOT_STARTED")
    now = utcnow()
    # rule 6: when the OUTBOUND trip ends, everyone still waiting is absent
    if trip.direction == TripDirection.outbound:
        for r in session.scalars(select(TripRider).where(
                TripRider.trip_id == trip.id, TripRider.state == RiderState.waiting)):
            r.state = RiderState.absent
            emit_event(session, "event.attendance", {"student_id": str(r.student_id), "type": "absent",
                                                     "notify_guardian": True})
    for r in session.scalars(select(TripRider).where(
            TripRider.trip_id == trip.id, TripRider.state == RiderState.boarded)):
        r.arrived_at = now
        emit_event(session, "event.attendance", {"student_id": str(r.student_id), "type": "arrived"})
    trip.status, trip.ended_at = TripStatus.ended, now
    session.commit()
    emit_event(session, "status.trip", {"trip_id": str(trip.id), "status": "ended"})
    return _trip_out(session, trip)


def report_delay(session: Session, user: CurrentUser, trip_id: uuid.UUID, body: DelayIn) -> dict:
    trip = _trip_or_404(session, trip_id)
    _assert_crew_of_trip(session, user, trip)
    if body.minutes not in ALLOWED_DELAY_MINUTES:
        raise err(422, "VALIDATION_ERROR", f"minutes must be one of {sorted(ALLOWED_DELAY_MINUTES)}")
    dep = at_cairo(trip.service_date, trip.departure_time)
    now = utcnow()
    in_window = trip.status == TripStatus.in_progress or (dep - DELAY_WINDOW <= now <= dep + DELAY_WINDOW)
    if trip.status == TripStatus.ended or not in_window:
        raise err(409, "DELAY_OUT_OF_WINDOW")
    d = TripDelay(trip_id=trip.id, minutes=body.minutes, reason=body.reason, note=body.note, reported_by=user.id)
    session.add(d)
    session.commit()
    # published as an official `delay` announcement + notification for the line's students & guardians
    emit_event(session, "announcement.delay", {"line_id": str(trip.line_id), "minutes": d.minutes,
                                                "reason": d.reason.value})
    return {"delay_id": str(d.id), "minutes": d.minutes, "reason": d.reason.value,
            "note": d.note, "reported_at": d.reported_at}


def _resolve_scanned_student(session: Session, body: ScanIn) -> uuid.UUID:
    if body.method == ScanMethod.manual:
        if not body.identifier:
            raise err(422, "VALIDATION_ERROR", "identifier is required for manual scan")
        sid = student_by_identifier(session, body.identifier)
        if not sid:
            raise err(404, "STUDENT_NOT_FOUND")
        return sid
    if not body.qr_token:
        raise err(422, "VALIDATION_ERROR", "qr_token is required for qr scan")
    try:   # Ahmed's card module signs/verifies the Ed25519 token
        from app.modules.card.service import verify_card_token   # type: ignore
    except ImportError:
        raise err(501, "CARD_MODULE_NOT_INTEGRATED", "card module not merged yet")
    return verify_card_token(session, body.qr_token)["student_id"]   # raises CARD_INVALID / CARD_EXPIRED


def scan(session: Session, user: CurrentUser, trip_id: uuid.UUID, body: ScanIn) -> dict:
    trip = _trip_or_404(session, trip_id)
    _assert_crew_of_trip(session, user, trip)
    if trip.status == TripStatus.ended:
        raise err(409, "TRIP_ALREADY_ENDED")
    if trip.status != TripStatus.in_progress:
        raise err(409, "TRIP_NOT_STARTED")
    if body.action == "checkout" and not body.reason:
        raise err(422, "REASON_REQUIRED")
    student_id = _resolve_scanned_student(session, body)
    rider = session.scalar(select(TripRider).where(
        TripRider.trip_id == trip.id, TripRider.student_id == student_id).with_for_update())
    if not rider:
        raise err(409, "NOT_ON_THIS_TRIP")
    now = utcnow()
    if body.action == "board":
        if rider.state in (RiderState.boarded, RiderState.checked_out):
            raise err(409, "ALREADY_BOARDED")
        rider.state, rider.boarded_at = RiderState.boarded, now
        rider.going_not_reason = None
        ev = "boarded"
    else:
        if rider.state != RiderState.boarded:
            raise err(409, "NOT_ON_BOARD")
        rider.state, rider.checked_out_at = RiderState.checked_out, now
        rider.checkout_reason, rider.checkout_note = body.reason, body.note
        ev = "checked_out"          # guardian is told immediately, no approval (rule 7)
    rider.scan_method, rider.scanned_by_user_id = body.method, user.id
    session.commit()
    emit_event(session, "event.attendance", {"student_id": str(student_id), "type": ev, "trip_id": str(trip.id)})
    stops = {s.id: s for s in session.scalars(select(Stop).where(Stop.line_id == trip.line_id))}
    return {"rider": _rider_out(session, rider, stops), "counts": _counts(session, trip.id)}


# ---- absences ('مش هروح') ---------------------------------------------------
def _absence_cutoff(session: Session, line_id: uuid.UUID, d: date) -> datetime:
    first = session.scalar(select(func.min(Stop.pickup_time)).where(Stop.line_id == line_id))
    return at_cairo(d, first or FALLBACK_FIRST_PICKUP)


def _absence_out(a: Absence) -> dict:
    return {"absence_id": str(a.id), "service_date": a.service_date, "reason": a.reason.value,
            "note": a.note, "cutoff_at": a.cutoff_at, "created_at": a.created_at}


def my_absences(session: Session, student_id: uuid.UUID) -> dict:
    line_id = student_active_line_id(session, student_id)
    if not line_id:
        raise err(409, "NO_ACTIVE_SUBSCRIPTION")
    today, now = cairo_today(), utcnow()
    mine = session.scalars(select(Absence).where(
        Absence.student_id == student_id, Absence.status == AbsenceStatus.active,
        Absence.service_date >= today).order_by(Absence.service_date)).all()
    taken = {a.service_date for a in mine}
    reportable = []
    for i in range(ABSENCE_HORIZON_DAYS + 1):
        d = today + timedelta(days=i)
        cutoff = _absence_cutoff(session, line_id, d)
        if is_service_day(d) and d not in taken and cutoff > now:
            reportable.append({"service_date": d, "cutoff_at": cutoff})
    return {"upcoming": [_absence_out(a) for a in mine], "reportable_days": reportable}


def create_absence(session: Session, student_id: uuid.UUID, body: AbsenceIn) -> dict:
    line_id = student_active_line_id(session, student_id)
    if not line_id:
        raise err(409, "NO_ACTIVE_SUBSCRIPTION")
    today = cairo_today()
    if (not is_service_day(body.service_date) or body.service_date < today
            or body.service_date > today + timedelta(days=ABSENCE_HORIZON_DAYS)):
        raise err(422, "DATE_NOT_REPORTABLE")
    cutoff = _absence_cutoff(session, line_id, body.service_date)
    if utcnow() >= cutoff:
        raise err(409, "PASSED_CUTOFF_ABSENCE")
    if session.scalar(select(Absence.id).where(
            Absence.student_id == student_id, Absence.service_date == body.service_date,
            Absence.status == AbsenceStatus.active)):
        raise err(409, "ALREADY_REPORTED")
    a = Absence(student_id=student_id, service_date=body.service_date, reason=body.reason,
                note=body.note, cutoff_at=cutoff)
    session.add(a)
    for r in session.scalars(select(TripRider).join(Trip, Trip.id == TripRider.trip_id).where(
            TripRider.student_id == student_id, Trip.service_date == body.service_date,
            TripRider.state == RiderState.waiting)):
        r.state, r.going_not_reason = RiderState.not_going, body.reason
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise err(409, "ALREADY_REPORTED")
    # goes to office, driver and guardian - at the time of reporting, not only on trip day
    emit_event(session, "event.attendance", {"student_id": str(student_id), "type": "not_going",
                                             "service_date": str(body.service_date)})
    return _absence_out(a)


def cancel_absence(session: Session, student_id: uuid.UUID, absence_id: uuid.UUID) -> dict:
    a = session.get(Absence, absence_id)
    if not a or a.student_id != student_id or a.status != AbsenceStatus.active:
        raise err(404, "NOT_FOUND")
    if utcnow() >= a.cutoff_at:
        raise err(409, "PASSED_CUTOFF_ABSENCE")
    a.status, a.cancelled_at = AbsenceStatus.cancelled, utcnow()
    for r in session.scalars(select(TripRider).join(Trip, Trip.id == TripRider.trip_id).where(
            TripRider.student_id == student_id, Trip.service_date == a.service_date,
            TripRider.state == RiderState.not_going)):
        r.state, r.going_not_reason = RiderState.waiting, None
    session.commit()
    return {"ok": True}


# ---- "رحلاتي" (my attendance) -------------------------------------------------
_OUTCOME = {RiderState.boarded: "rode", RiderState.checked_out: "out_checked",
            RiderState.not_going: "going_not", RiderState.absent: "absent"}


def my_attendance(session: Session, student_id: uuid.UUID, lang: str, page: int, page_size: int,
                  outcome: Optional[str]) -> dict:
    base = (select(TripRider, Trip, Line, Stop)
            .join(Trip, Trip.id == TripRider.trip_id).join(Line, Line.id == Trip.line_id)
            .outerjoin(Stop, Stop.id == TripRider.stop_id)
            .where(TripRider.student_id == student_id, TripRider.state != RiderState.waiting))
    summary_rows = dict(session.execute(select(TripRider.state, func.count()).where(
        TripRider.student_id == student_id).group_by(TripRider.state)).all())
    summary = {"rode": summary_rows.get(RiderState.boarded, 0), "absent": summary_rows.get(RiderState.absent, 0),
               "not_going": summary_rows.get(RiderState.not_going, 0),
               "checked_out": summary_rows.get(RiderState.checked_out, 0)}
    if outcome:
        inv = {v: k for k, v in _OUTCOME.items()}
        if outcome not in inv:
            raise err(422, "VALIDATION_ERROR", "unknown outcome")
        base = base.where(TripRider.state == inv[outcome])
    total = session.scalar(select(func.count()).select_from(base.subquery()))
    rows = session.execute(base.order_by(Trip.service_date.desc(), Trip.departure_time.desc())
                           .limit(page_size).offset((page - 1) * page_size)).all()
    items = [{"trip_id": str(t.id), "service_date": t.service_date, "direction": t.direction.value,
              "line": pick_lang(lang, l.ar_name, l.en_name),
              "stop_name": pick_lang(lang, s.ar_name, s.en_name) if s else None,
              "outcome": _OUTCOME[r.state], "boarded_at": r.boarded_at, "arrived_at": r.arrived_at,
              "checked_out_at": r.checked_out_at,
              "reason_checkout": r.checkout_reason.value if r.checkout_reason else None}
             for r, t, l, s in rows]
    return {"items": items, "total": total, "summary": summary}


# ---- office: live map, lines, attendance ------------------------------------------
def live_overview(session: Session) -> dict:
    today = cairo_today()
    ensure_trips_for_date(session, today)
    now = utcnow()
    items = []
    for t in session.scalars(select(Trip).where(Trip.service_date == today,
                                                Trip.direction == TripDirection.outbound)):
        line, bus = session.get(Line, t.line_id), session.get(Bus, t.bus_id)
        drv = session.get(Driver, t.driver_id) if t.driver_id else None
        pos = session.get(BusLivePosition, t.bus_id)
        c = _counts(session, t.id)
        delay = session.scalar(select(TripDelay.minutes).where(TripDelay.trip_id == t.id)
                               .order_by(TripDelay.reported_at.desc()).limit(1))
        replaced = bool(session.scalar(select(TripReplacement.id).where(TripReplacement.trip_id == t.id).limit(1)))
        status = {"not_started": "not_started", "in_progress": "on_the_road", "ended": "arrived"}[t.status.value]
        items.append({
            "line": {"id": str(line.id), "code": line.code, "name": line.ar_name}, "trip_id": str(t.id),
            "bus": {"plate": bus.plate_number, "bus_type": bus.bus_type.value,
                    "driver_name": drv.full_name if drv else None,
                    "driver_phone": drv.phone_number if drv else None, "replaced": replaced},
            "status": status,
            "position": ({"lat": pos.lat, "lng": pos.lng, "heading": pos.heading, "speed_kmh": pos.speed_kmh,
                          "recorded_at": pos.recorded_at} if pos and t.status == TripStatus.in_progress else None),
            "leaves_at": at_cairo(t.service_date, t.departure_time), "subscribers": c["total"],
            "rode": c["boarded"] + c["checked_out"], "delay_minutes": delay or 0,
            "sos_open": has_open_sos(session, t.id)})
    return {"items": items, "generated_at": now,
            "campus_location": None}   # TODO: campus lat/lng once the office sends it


def admin_lines(session: Session) -> dict:
    lines = session.scalars(select(Line).order_by(Line.code)).all()
    used = seats_used_by_line(session, [l.id for l in lines])
    items = []
    for l in lines:
        a = session.scalar(select(LineAssignment).where(LineAssignment.line_id == l.id,
                                                        LineAssignment.is_active.is_(True)).limit(1))
        bus = session.get(Bus, a.bus_id) if a else None
        drv = session.get(Driver, a.driver_id) if a and a.driver_id else None
        items.append({"id": str(l.id), "code": l.code, "name": l.ar_name, "stops": len(l.stops),
                      "pickup_first": hhmm(first_pickup_time(l)), "subscribers": used.get(l.id, 0),
                      "free_seats": max(l.total_seats - used.get(l.id, 0), 0),
                      "bus": {"plate": bus.plate_number, "bus_type": bus.bus_type.value} if bus else None,
                      "driver": {"name": drv.full_name, "phone": drv.phone_number} if drv else None})
    return {"items": items, "totals": {"lines": len(items), "subscribers": sum(i["subscribers"] for i in items),
                                       "free_seats": sum(i["free_seats"] for i in items)}}


def admin_line_detail(session: Session, line_id: uuid.UUID) -> dict:
    line = _get_line(session, line_id)
    today = cairo_today()
    trip = session.scalar(select(Trip).where(Trip.line_id == line.id, Trip.service_date == today,
                                             Trip.direction == TripDirection.outbound).limit(1))
    stops = {s.id: s for s in line.stops}
    students = []
    for r in active_subscribers(session, line.id):
        n, i = student_display(session, r.student_id)
        s = stops.get(r.stop_id)
        students.append({"student_id": str(r.student_id), "name": n, "identifier": i,
                         "stop_name": s.ar_name if s else None})
    used = seats_used_by_line(session, [line.id]).get(line.id, 0)
    out = line_to_out(line, "ar", used)
    out.update({"students": students, "trip_id_today": str(trip.id) if trip else None})
    return out


def admin_attendance(session: Session, line_id: uuid.UUID, d: date) -> dict:
    if d > cairo_today() or d < cairo_today() - timedelta(days=31):
        raise err(422, "DATE_INVALID")
    _get_line(session, line_id)
    if not is_service_day(d):
        return {"service_day": False, "status_trip": "no_service", "counts": None, "riders": []}
    trip = session.scalar(select(Trip).where(Trip.line_id == line_id, Trip.service_date == d,
                                             Trip.direction == TripDirection.outbound).limit(1))
    if not trip:
        return {"service_day": True, "status_trip": "no_service", "counts": None, "riders": []}
    return {"service_day": True, "status_trip": trip.status.value, "counts": _counts(session, trip.id),
            "riders": riders_of_trip(session, trip)}


# ---- office: CRUD -------------------------------------------------------------------
def _replace_stops(session: Session, line: Line, stops: list[StopIn]) -> None:
    orders = [s.order for s in stops]
    if len(set(orders)) != len(orders):
        raise err(422, "VALIDATION_ERROR", "duplicate stop order")
    line.stops.clear()
    session.flush()
    for s in stops:
        h, m = (int(x) for x in s.pickup_time.split(":")) if s.pickup_time else (None, None)
        line.stops.append(Stop(ar_name=s.ar_name, en_name=s.en_name, stop_order=s.order,
                               pickup_time=time(h, m) if h is not None else None,
                               lat=s.lat, lng=s.lng, note=s.note))


def create_line(session: Session, user: CurrentUser, body: LineCreate) -> dict:
    if session.scalar(select(Line.id).where(Line.code == body.code)):
        raise err(409, "CONFLICT", "line code already exists")
    line = Line(code=body.code, ar_name=body.ar_name, en_name=body.en_name,
                price_piasters=body.price_piasters, bus_type=body.bus_type,
                total_seats=body.total_seats or SEATS_BY_BUS_TYPE.get(body.bus_type.value if body.bus_type else "", 0))
    session.add(line)
    _replace_stops(session, line, body.stops)
    record_audit(session, user.id, "line_created", "operations", body.code)
    session.commit()
    return line_detail(session, user, line.id, "ar")


def update_line(session: Session, user: CurrentUser, line_id: uuid.UUID, body: LineUpdate) -> dict:
    line = _get_line(session, line_id)
    data = body.model_dump(exclude_unset=True)
    stops = data.pop("stops", None)
    for k, v in data.items():
        setattr(line, k, v)
    if stops is not None:
        _replace_stops(session, line, body.stops or [])
    record_audit(session, user.id, "line_updated", "operations", line.code)
    session.commit()
    return line_detail(session, user, line.id, "ar")


def set_return_time(session: Session, user: CurrentUser, body: ReturnTimeIn) -> dict:
    h, m = (int(x) for x in body.return_departure_time.split(":"))
    t = time(h, m)
    if not (RETURN_TIME_MIN <= t <= RETURN_TIME_MAX):
        raise err(422, "RETURN_TIME_OUT_OF_RANGE", "Return time must be between 12:00 and 20:00")
    q = select(Line)
    if body.line_ids:
        q = q.where(Line.id.in_(body.line_ids))
    lines = session.scalars(q).all()
    if body.line_ids and len(lines) != len(set(body.line_ids)):
        raise err(404, "LINE_NOT_FOUND")
    for l in lines:
        l.return_departure_time = None if (not body.line_ids and t == DEFAULT_RETURN_TIME) else t
    record_audit(session, user.id, "changed_return_time", "operations",
                 ",".join(l.code for l in lines)[:200], body.return_departure_time)
    session.commit()
    # service_change announcement + notification to each changed line's students and guardians
    emit_event(session, "announcement.service_change",
               {"line_ids": [str(l.id) for l in lines], "return_departure_time": body.return_departure_time})
    return timetable(session)


def timetable(session: Session) -> dict:
    lines = session.scalars(select(Line).order_by(Line.code)).all()
    return {"default_return_time": hhmm(DEFAULT_RETURN_TIME),
            "items": [{"line": l.code, "stop_count": len(l.stops), "first_pickup_time": hhmm(first_pickup_time(l)),
                       "campus_arrival": hhmm(l.arrival_campus_to),
                       "return_departure_time": hhmm(l.return_departure_time),   # None = default
                       "changed_by_name": None, "changed_at": l.updated_at} for l in lines]}


# ---- replacement (transport_admin ONLY; super_admin is view-only -> 403) -----------------
def replacement_options(session: Session, trip_id: uuid.UUID) -> dict:
    trip = _trip_or_404(session, trip_id)
    busy_bus = select(Trip.bus_id).where(Trip.service_date == trip.service_date, Trip.status != TripStatus.ended)
    busy_drv = select(Trip.driver_id).where(Trip.service_date == trip.service_date,
                                            Trip.status != TripStatus.ended, Trip.driver_id.is_not(None))
    spares = session.scalars(select(Bus).where(Bus.is_spare.is_(True), Bus.is_active.is_(True),
                                               Bus.id.not_in(busy_bus))).all()
    drivers = session.scalars(select(Driver).where(Driver.is_active.is_(True), Driver.id.not_in(busy_drv))).all()
    cur_bus, cur_drv = session.get(Bus, trip.bus_id), (session.get(Driver, trip.driver_id) if trip.driver_id else None)
    return {"current": {"bus": {"bus_id": str(cur_bus.id), "plate": cur_bus.plate_number},
                        "driver": {"driver_id": str(cur_drv.id), "name": cur_drv.full_name} if cur_drv else None,
                        "riders": _counts(session, trip.id)["total"]},
            "spare_buses": [{"bus_id": str(b.id), "plate": b.plate_number, "bus_type": b.bus_type.value,
                             "seats": b.capacity,
                             "driver": {"driver_id": str(b.default_driver_id)} if b.default_driver_id else None}
                            for b in spares],
            "spare_drivers": [{"driver_id": str(d.id), "name": d.full_name, "phone": d.phone_number}
                              for d in drivers]}


def replace_on_trip(session: Session, user: CurrentUser, trip_id: uuid.UUID, body: ReplacementIn) -> dict:
    trip = session.scalar(select(Trip).where(Trip.id == trip_id).with_for_update())
    if not trip:
        raise err(404, "NOT_FOUND", "Trip not found")
    if trip.status == TripStatus.ended:
        raise err(409, "TRIP_ALREADY_ENDED")
    if not body.bus_id and not body.driver_id:
        raise err(422, "NOTHING_TO_CHANGE")
    new_bus_id = body.bus_id or trip.bus_id
    new_driver_id = body.driver_id
    if body.bus_id:
        bus = session.get(Bus, body.bus_id)
        clash = session.scalar(select(Trip.id).where(
            Trip.bus_id == body.bus_id, Trip.service_date == trip.service_date,
            Trip.status != TripStatus.ended, Trip.id != trip.id))
        if not bus or not bus.is_active or clash:
            raise err(409, "BUS_NOT_AVAILABLE")
        new_driver_id = body.driver_id or bus.default_driver_id      # bus comes with its own driver
    if new_driver_id:
        d = session.get(Driver, new_driver_id)
        clash = session.scalar(select(Trip.id).where(
            Trip.driver_id == new_driver_id, Trip.service_date == trip.service_date,
            Trip.status != TripStatus.ended, Trip.id != trip.id))
        if not d or not d.is_active or clash:
            raise err(409, "DRIVER_NOT_AVAILABLE")
    else:
        new_driver_id = trip.driver_id
    if new_bus_id == trip.bus_id and new_driver_id == trip.driver_id:
        raise err(422, "NOTHING_TO_CHANGE")
    # TODO: SOS_CLOSED (409) check when body.sos_id is given - needs the SOS owner's lookup
    rep = TripReplacement(trip_id=trip.id, old_bus_id=trip.bus_id, new_bus_id=new_bus_id,
                          old_driver_id=trip.driver_id, new_driver_id=new_driver_id,
                          reason=body.reason, note=body.note, sos_id=body.sos_id, by_user_id=user.id)
    session.add(rep)
    trip.bus_id, trip.driver_id = new_bus_id, new_driver_id          # riders/scans stay on the same trip_id
    record_audit(session, user.id, "replacement_sent", "emergencies", str(trip.id), body.reason.value)
    session.commit()
    emit_event(session, "status.trip", {"trip_id": str(trip.id), "status": "replaced"})
    emit_event(session, "announcement.change_service", {"line_id": str(trip.line_id), "kind": "replacement"})
    bus, drv = session.get(Bus, new_bus_id), (session.get(Driver, new_driver_id) if new_driver_id else None)
    return {"replacement_id": str(rep.id),
            "bus": {"bus_id": str(bus.id), "plate": bus.plate_number, "bus_type": bus.bus_type.value},
            "driver": {"driver_id": str(drv.id), "name": drv.full_name, "phone": drv.phone_number} if drv else None,
            "reason": rep.reason.value, "note": rep.note, "sos_id": str(rep.sos_id) if rep.sos_id else None,
            "by_name": user.name, "at": rep.created_at}


# =============================================================================
# 5. ROUTER   (Muhammad Ali registers `router` in app/api/v1/router.py)
# =============================================================================
router = APIRouter(tags=["operations"])
Db = Depends(get_db_session)
student_only = require_roles("student")
crew_only = require_roles(*CREW_ROLES)
office = require_roles(*OFFICE_ROLES)
transport_only = require_roles("transport_admin")          # super_admin gets 403 here


# ---- student / everyone --------------------------------------------------------------
@router.get("/lines", response_model=list[LineOut])
def get_lines(session: Session = Db, lang: str = Depends(get_lang),
              user: CurrentUser = Depends(get_current_user)):
    return list_lines(session, lang)


@router.get("/lines/{line_id}", response_model=LineDetailOut)
def get_line(line_id: uuid.UUID, session: Session = Db, lang: str = Depends(get_lang),
             user: CurrentUser = Depends(get_current_user)):
    return line_detail(session, user, line_id, lang)


@router.get("/absences/me")
def get_my_absences(session: Session = Db, user: CurrentUser = Depends(student_only)):
    return my_absences(session, user.id)


@router.post("/absences", status_code=201)
def post_absence(body: AbsenceIn, session: Session = Db, user: CurrentUser = Depends(student_only),
                 key: Optional[str] = Depends(idempotency_key)):
    return run_idempotent(session, user.id, key, "POST /absences", lambda: create_absence(session, user.id, body))


@router.post("/absences/{absence_id}/cancel")
def post_cancel_absence(absence_id: uuid.UUID, session: Session = Db, user: CurrentUser = Depends(student_only),
                        key: Optional[str] = Depends(idempotency_key)):
    return run_idempotent(session, user.id, key, f"POST /absences/{absence_id}/cancel",
                          lambda: cancel_absence(session, user.id, absence_id))


@router.get("/attendance/me")
def get_my_attendance(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                      outcome: Optional[str] = None, session: Session = Db,
                      lang: str = Depends(get_lang), user: CurrentUser = Depends(student_only)):
    return my_attendance(session, user.id, lang, page, page_size, outcome)


# ---- driver / supervisor ----------------------------------------------------------------
# NOTE: agreement open question - `/driver/trip/today` vs `/crew/today`; kept as the agreement says.
@router.get("/driver/trip/today")
def get_driver_today(session: Session = Db, lang: str = Depends(get_lang),
                     user: CurrentUser = Depends(crew_only)):
    return crew_today(session, user, lang)


@router.post("/trips/{trip_id}/start")
def post_start_trip(trip_id: uuid.UUID, session: Session = Db, user: CurrentUser = Depends(crew_only),
                    key: Optional[str] = Depends(idempotency_key)):
    return run_idempotent(session, user.id, key, f"POST /trips/{trip_id}/start",
                          lambda: start_trip(session, user, trip_id))


@router.post("/trips/{trip_id}/end")
def post_end_trip(trip_id: uuid.UUID, session: Session = Db, user: CurrentUser = Depends(crew_only),
                  key: Optional[str] = Depends(idempotency_key)):
    return run_idempotent(session, user.id, key, f"POST /trips/{trip_id}/end",
                          lambda: end_trip(session, user, trip_id))


@router.post("/trips/{trip_id}/scan")
def post_scan(trip_id: uuid.UUID, body: ScanIn, session: Session = Db,
              user: CurrentUser = Depends(crew_only), key: Optional[str] = Depends(idempotency_key)):
    return run_idempotent(session, user.id, key, f"POST /trips/{trip_id}/scan",
                          lambda: scan(session, user, trip_id, body))


@router.post("/trips/{trip_id}/delay", status_code=201)
def post_delay(trip_id: uuid.UUID, body: DelayIn, session: Session = Db,
               user: CurrentUser = Depends(crew_only), key: Optional[str] = Depends(idempotency_key)):
    return run_idempotent(session, user.id, key, f"POST /trips/{trip_id}/delay",
                          lambda: report_delay(session, user, trip_id, body))


# ---- transport office: monitoring (transport_admin + super_admin read) -----------------------
@router.get("/admin/live")
def get_admin_live(session: Session = Db, user: CurrentUser = Depends(office)):
    return live_overview(session)


@router.get("/admin/lines")
def get_admin_lines(session: Session = Db, user: CurrentUser = Depends(office)):
    return admin_lines(session)


@router.get("/admin/lines/{line_id}")
def get_admin_line(line_id: uuid.UUID, session: Session = Db, user: CurrentUser = Depends(office)):
    return admin_line_detail(session, line_id)


@router.get("/admin/attendance")
def get_admin_attendance(line_id: uuid.UUID, date: date, session: Session = Db,
                         user: CurrentUser = Depends(office)):
    return admin_attendance(session, line_id, date)


@router.get("/admin/trips/{trip_id}/riders")
def get_admin_trip_riders(trip_id: uuid.UUID, session: Session = Db, user: CurrentUser = Depends(office)):
    trip = _trip_or_404(session, trip_id)
    return {"counts": _counts(session, trip.id), "riders": riders_of_trip(session, trip)}


# ---- transport office: CRUD ----------------------------------------------------------------------
@router.post("/admin/lines", status_code=201)
def post_admin_line(body: LineCreate, session: Session = Db, user: CurrentUser = Depends(office)):
    return create_line(session, user, body)


@router.patch("/admin/lines/{line_id}")
def patch_admin_line(line_id: uuid.UUID, body: LineUpdate, session: Session = Db,
                     user: CurrentUser = Depends(office)):
    return update_line(session, user, line_id, body)


@router.get("/admin/buses")
def get_admin_buses(session: Session = Db, user: CurrentUser = Depends(office)):
    buses = session.scalars(select(Bus).order_by(Bus.bus_code)).all()
    return {"items": [{"id": str(b.id), "plate": b.plate_number, "bus_code": b.bus_code,
                       "bus_type": b.bus_type.value, "capacity": b.capacity, "owner": b.owner.value,
                       "is_spare": b.is_spare, "is_active": b.is_active,
                       "default_driver_id": str(b.default_driver_id) if b.default_driver_id else None}
                      for b in buses], "total": len(buses)}


@router.post("/admin/buses", status_code=201)
def post_admin_bus(body: BusIn, session: Session = Db, user: CurrentUser = Depends(office)):
    if session.scalar(select(Bus.id).where(or_(Bus.plate_number == body.plate_number,
                                                Bus.bus_code == body.bus_code))):
        raise err(409, "CONFLICT", "plate or bus code already exists")
    b = Bus(plate_number=body.plate_number, bus_code=body.bus_code, bus_type=body.bus_type,
            capacity=body.capacity or SEATS_BY_BUS_TYPE[body.bus_type.value], owner=body.owner,
            default_driver_id=body.default_driver_id, is_spare=body.is_spare)
    session.add(b)
    record_audit(session, user.id, "bus_created", "operations", body.plate_number)
    session.commit()
    return {"id": str(b.id)}


@router.patch("/admin/buses/{bus_id}")
def patch_admin_bus(bus_id: uuid.UUID, body: BusUpdate, session: Session = Db,
                    user: CurrentUser = Depends(office)):
    b = session.get(Bus, bus_id)
    if not b:
        raise err(404, "NOT_FOUND")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(b, k, v)
    record_audit(session, user.id, "bus_updated", "operations", b.plate_number)
    session.commit()
    return {"id": str(b.id)}


@router.get("/admin/drivers")
def get_admin_drivers(session: Session = Db, user: CurrentUser = Depends(office)):
    ds = session.scalars(select(Driver).order_by(Driver.full_name)).all()
    return {"items": [{"id": str(d.id), "name": d.full_name, "phone": d.phone_number,
                       "license_number": d.license_number, "is_active": d.is_active} for d in ds],
            "total": len(ds)}


@router.post("/admin/drivers", status_code=201)
def post_admin_driver(body: DriverIn, session: Session = Db, user: CurrentUser = Depends(office)):
    if session.scalar(select(Driver.id).where(Driver.license_number == body.license_number)):
        raise err(409, "CONFLICT", "license number already exists")
    d = Driver(full_name=body.full_name, phone_number=body.phone_number,
               license_number=body.license_number, user_id=body.user_id)
    session.add(d)
    record_audit(session, user.id, "driver_created", "operations", body.license_number)
    session.commit()
    return {"id": str(d.id)}


@router.patch("/admin/drivers/{driver_id}")
def patch_admin_driver(driver_id: uuid.UUID, body: DriverUpdate, session: Session = Db,
                       user: CurrentUser = Depends(office)):
    d = session.get(Driver, driver_id)
    if not d:
        raise err(404, "NOT_FOUND")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(d, k, v)
    record_audit(session, user.id, "driver_updated", "operations", d.license_number)
    session.commit()
    return {"id": str(d.id)}


@router.post("/admin/assignments", status_code=201)
def post_admin_assignment(body: AssignmentIn, session: Session = Db, user: CurrentUser = Depends(office)):
    _get_line(session, body.line_id)
    if not session.get(Bus, body.bus_id):
        raise err(404, "NOT_FOUND", "bus not found")
    a = LineAssignment(line_id=body.line_id, bus_id=body.bus_id, driver_id=body.driver_id,
                       supervisor_user_id=body.supervisor_user_id, starts_on=body.starts_on or cairo_today())
    session.add(a)
    record_audit(session, user.id, "assignment_created", "operations", str(body.line_id))
    session.commit()
    return {"id": str(a.id)}


@router.get("/admin/timetable")
def get_admin_timetable(session: Session = Db, user: CurrentUser = Depends(office)):
    return timetable(session)


@router.put("/admin/timetable/return-time")
def put_return_time(body: ReturnTimeIn, session: Session = Db, user: CurrentUser = Depends(office)):
    return set_return_time(session, user, body)


# ---- replacement: transport_admin ONLY (super_admin -> 403) ---------------------------------------------
@router.get("/admin/trips/{trip_id}/replacement-options")
def get_replacement_options(trip_id: uuid.UUID, session: Session = Db,
                            user: CurrentUser = Depends(transport_only)):
    return replacement_options(session, trip_id)


@router.post("/admin/trips/{trip_id}/replacement", status_code=201)
def post_replacement(trip_id: uuid.UUID, body: ReplacementIn, session: Session = Db,
                     user: CurrentUser = Depends(transport_only),
                     key: Optional[str] = Depends(idempotency_key)):
    return run_idempotent(session, user.id, key, f"POST /admin/trips/{trip_id}/replacement",
                          lambda: replace_on_trip(session, user, trip_id, body))


# ==========================================
# TODO: INTEGRATION NOTES
# ==========================================
# 1. أولاً: قسّم الملف ده على app/modules/operations/ (models.py / schemas.py / service.py / router.py)
#    زي ما موضح في أول الملف، واستورد Base و get_db_session من app/db/base.py و app/db/session.py.
#
# 2. في المصادقة (محمود):
#    - استبدال get_current_user و CurrentUser بالـ dependency بتاعته (الأدوار: student / parent /
#      driver / supervisor / transport_admin / super_admin).
#    - الربط بين drivers.user_id و users.id (دلوقتي UUID عادي + index من غير ForeignKey).
#    - supervisor_user_id في line_assignments و trips و trip_riders.student_id و
#      trip_riders.scanned_by_user_id و trip_delays.reported_by و trip_replacements.by_user_id
#      و absences.student_id: كلهم ForeignKey لـ users.id عند (محمود / محمد علي).
#
# 3. عند أحمد (الاشتراكات - جدول subscriptions):
#    - بقرا من subscriptions بـ SQL مباشر (seats_used_by_line / student_active_line_id /
#      active_subscribers). الأعمدة المفترضة: student_id, line_id, stop_id, status, activated_at.
#      لما يتدمج: ربط line_id بـ lines.id و stop_id بـ stops.id عند أحمد، واستبدال الـ SQL
#      بدوال الـ service بتاعته.
#    - تغيير الخط المؤقت/الدايم: student_active_line_id لازم يستخدم get_effective_line بتاعته
#      (الرحلة الجاية / الكارنيه / الكشوف / التتبع).
#    - مسح الـ QR: _resolve_scanned_student بيستدعي app.modules.card.service.verify_card_token
#      (عند أحمد) ويرجع dict فيه student_id، وبيرمي CARD_INVALID / CARD_EXPIRED.
#
# 4. جدول users (محمود / محمد علي): student_by_identifier و student_display بيقروا
#    users.identifier و users.name بـ SQL مباشر. تأكيد الأعمدة وقت الدمج.
#
# 5. الـ GPS والطوارئ (محمود / صاحب الـ GPS):
#    - bus_live_positions جدول آخر موقع لكل باص. الـ ingest عندهم لازم يعمل upsert فيه
#      (أو نقرا من جدول trip_locations بتاعهم ونشيل الجدول ده).
#    - has_open_sos بيقرا sos_alerts(trip_id, status) بـ SQL؛ و trip_replacements.sos_id
#      لازم يتربط بـ sos_alerts.id، وإضافة تحقق SOS_CLOSED في replace_on_trip.
#    - الحقل sos في _trip_out لسه None لحد ما بلاغ الطوارئ يتدمج.
#
# 6. محمد علي (الأساس):
#    - تسجيل router في app/api/v1/router.py، وتسطيح الأخطاء {"code","message"}.
#    - record_audit بيحاول يستدعي app.common.audit.write_audit؛ لو الاسم مختلف عدّله هنا.
#    - ops_idempotency_keys ممكن تتحول لجدول مشترك واحد في app/common.
#    - إنشاء migration واحد لكل الجداول (lines, stops, drivers, buses, line_assignments, trips,
#      trip_riders, trip_delays, trip_replacements, absences, bus_live_positions,
#      ops_idempotency_keys) + الـ Enums.
#
# 7. الإشعارات والـ WebSocket (لسه من غير مالك): emit_event مجرد logging دلوقتي.
#    - الأحداث: status.trip / event.attendance / announcement.delay / announcement.service_change.
#    - ensure_trips_for_date محتاج scheduler يشغله كل ليلة (أحد-خميس).
#
# 8. حقول لسه محتاجة بيانات من مكتب النقل: إحداثيات المحطات (stops.lat/lng) والسعة الحقيقية
#    للباصات. ولو جيو-سبيشيال اتطلب: stops.lat/lng تتحول لـ Point (PostGIS) عند صاحب الجيو.
#
# 9. أسماء الـ endpoints /driver/trip/today vs /crew/today: ماشيين على اللي في الاتفاق (سؤال
#    مفتوح في المستند). أسماء الحقول والأكواد تتراجع على openapi.json بتاع الفرونت.
