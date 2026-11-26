"""Persistent emergency reports, immutable actions, idempotency, and delivery outbox."""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.models import BaseModel


class SOSReport(BaseModel):
    __tablename__ = "sos_reports"

    type: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="open", index=True)
    note: Mapped[str | None] = mapped_column(String(300))
    trip_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    line_id: Mapped[str] = mapped_column(String(64), nullable=False)
    bus_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    direction: Mapped[str] = mapped_column(String(16), nullable=False)
    raised_by_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    raised_by_role: Mapped[str] = mapped_column(String(16), nullable=False)
    raised_by_name: Mapped[str] = mapped_column(String(200), nullable=False)
    raised_by_phone: Mapped[str | None] = mapped_column(String(32))
    location_lat: Mapped[float | None] = mapped_column(nullable=True)
    location_lng: Mapped[float | None] = mapped_column(nullable=True)
    location_fix_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    riders_on_board: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    acknowledged_by_id: Mapped[str | None] = mapped_column(String(64))
    acknowledged_by_name: Mapped[str | None] = mapped_column(String(200))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    actions: Mapped[list["SOSActionLog"]] = relationship(
        back_populates="report",
        order_by="SOSActionLog.created_at",
        lazy="selectin",
    )


class SOSActionLog(BaseModel):
    """Append-only from the service API: there are no edit/delete operations."""

    __tablename__ = "sos_action_log"

    sos_id: Mapped[UUID] = mapped_column(
        ForeignKey("sos_reports.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    action: Mapped[str] = mapped_column(String(24), nullable=False)
    actor_id: Mapped[str] = mapped_column(String(64), nullable=False)
    actor_name: Mapped[str] = mapped_column(String(200), nullable=False)
    note: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    report: Mapped[SOSReport] = relationship(back_populates="actions")


class SOSIdempotency(BaseModel):
    __tablename__ = "sos_idempotency"
    __table_args__ = (UniqueConstraint("actor_id", "idempotency_key"),)

    actor_id: Mapped[str] = mapped_column(String(64), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(36), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    report_id: Mapped[UUID] = mapped_column(
        ForeignKey("sos_reports.id", ondelete="RESTRICT"), nullable=False
    )
    response_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)


class SOSOutboxEvent(BaseModel):
    """Transactional events for notification/WebSocket delivery by the integration worker."""

    __tablename__ = "sos_outbox"

    sos_id: Mapped[UUID] = mapped_column(
        ForeignKey("sos_reports.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
