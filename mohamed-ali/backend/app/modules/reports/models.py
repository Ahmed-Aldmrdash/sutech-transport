from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.common.models import BaseModel


class ReportExport(BaseModel):
    """سجل عمليات تصدير التقارير (JSON / XLSX / PDF) لمتابعة الحالة والتدقيق."""

    __tablename__ = "report_exports"
    __table_args__ = (
        CheckConstraint(
            "report_type IN ('roster', 'payments', 'attendance', 'seat_occupancy')",
            name="ck_report_exports_report_type",
        ),
        CheckConstraint(
            "file_format IN ('json', 'xlsx', 'pdf')",
            name="ck_report_exports_file_format",
        ),
        CheckConstraint(
            "status IN ('pending', 'processing', 'completed', 'failed')",
            name="ck_report_exports_status",
        ),
    )

    requested_by: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    report_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        index=True,
    )
    file_format: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(24),
        nullable=False,
        default="pending",
        server_default=text("'pending'"),
        index=True,
    )
    file_url: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
    )
    parameters: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )


class AuditLog(BaseModel):
    """سجل رقابة إداري للأمان وحماية البيانات (Append-only)."""

    __tablename__ = "audit_logs"

    actor_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )
    entity_name: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )
    entity_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        nullable=True,
        index=True,
    )
    changes: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
    )
    ip_address: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )