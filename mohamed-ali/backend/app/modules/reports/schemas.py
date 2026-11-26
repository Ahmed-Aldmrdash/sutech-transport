from __future__ import annotations

from datetime import date
from typing import Any, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator


ReportType = Literal["roster", "payments", "attendance", "seat_occupancy"]
ReportFormat = Literal["json", "xlsx", "pdf"]
ColumnKind = Literal["text", "number", "money", "date", "time", "percent"]
AuditArea = Literal[
    "payments",
    "requests",
    "violations",
    "announcements",
    "emergencies",
    "events",
    "users",
    "timetable",
    "reports",
]


class ReportQueryParams(BaseModel):
    """التحقق من باراميترات الفلترة والصفحات لطلب التقرير."""

    format: ReportFormat = "json"
    line: str | None = Field(default=None, description="معرّف الخط أو None لكل الخطوط")
    from_date: date | None = Field(default=None, alias="from")
    to_date: date | None = Field(default=None, alias="to")
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=200)

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="after")
    def validate_date_order(self) -> ReportQueryParams:
        if self.from_date and self.to_date and self.from_date > self.to_date:
            raise ValueError("INVALID_RANGE: 'from' date must not be after 'to' date.")
        return self


class ReportCatalogItem(BaseModel):
    type: ReportType
    title: str
    description: str
    uses_period: bool


class ReportCatalogResponse(BaseModel):
    items: list[ReportCatalogItem]


class ReportColumnSchema(BaseModel):
    key: str
    label: str
    kind: ColumnKind


class ReportAppliedFilters(BaseModel):
    line: str | None = None
    from_date: date | None = Field(default=None, serialization_alias="from")
    to_date: date | None = Field(default=None, serialization_alias="to")

    model_config = ConfigDict(populate_by_name=True)


class ReportSummaryItem(BaseModel):
    label: str
    value: int | float | str


class ReportJsonResponse(BaseModel):
    type: ReportType
    title: str
    columns: list[ReportColumnSchema]
    rows: list[dict[str, Any]]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=200)
    filters: ReportAppliedFilters
    summary: list[ReportSummaryItem]
    generated_at: AwareDatetime


class AuditQueryParams(BaseModel):
    area: AuditArea | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=25, ge=1, le=200)


class AuditActorSchema(BaseModel):
    name: str
    identifier: str | None = None
    role: str | None = None


class AuditLogItemResponse(BaseModel):
    audit_id: UUID
    at: AwareDatetime
    actor: AuditActorSchema
    action: str
    area: AuditArea
    target: str | None = None
    detail: str | None = None


class AuditLogListResponse(BaseModel):
    items: list[AuditLogItemResponse]
    total: int = Field(ge=0)