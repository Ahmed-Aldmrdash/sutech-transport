from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

from app.modules.reports.schemas import (
    ReportAppliedFilters,
    ReportColumnSchema,
    ReportFormat,
    ReportType,
)

CAIRO_TZ = ZoneInfo("Africa/Cairo")


def now_cairo() -> datetime:
    """إرجاع الوقت الحالي بتوقيت القاهرة (Timezone-Aware)."""
    return datetime.now(CAIRO_TZ)


def format_cairo_timestamp(dt: datetime | None = None) -> str:
    """تنسيق الطابع الزمني للعرض داخل ملفات Excel و PDF بتوقيت مصر."""
    target = dt.astimezone(CAIRO_TZ) if dt else now_cairo()
    return target.strftime("%Y-%m-%d %I:%M %p")


def build_export_filename(
    report_type: ReportType,
    file_format: ReportFormat,
    filters: ReportAppliedFilters,
    reference_date: date | None = None,
) -> str:
    """
    بناء اسم الملف حسب العقد:
    sutech_<type>_<line|all>_<from>_<to>.<ext>
    وفي حالة تقرير roster (بدون فترة) يُستخدم تاريخ اليوم بتوقيت القاهرة.
    """
    today = reference_date or now_cairo().date()
    line_part = (filters.line or "all").strip().replace(" ", "_")

    if report_type == "roster":
        period_part = today.isoformat()
    else:
        from_str = (filters.from_date or today).isoformat()
        to_str = (filters.to_date or today).isoformat()
        period_part = f"{from_str}_{to_str}"

    return f"sutech_{report_type}_{line_part}_{period_part}.{file_format}"


def piasters_to_egp(value: Any) -> float:
    """تحويل المبلغ من قرش (عدد صحيح داخلياً) إلى جنيه مصري للتصدير فقط."""
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float((value / Decimal(100)).quantize(Decimal("0.01")))
    return round(float(value) / 100.0, 2)


def format_cell_for_export(
    value: Any,
    column: ReportColumnSchema,
    for_pdf: bool = False,
) -> Any:
    """تنسيق قيمة الخلية حسب نوع العمود (money / percent / date / time / text)."""
    if value is None:
        return "-" if for_pdf else ""

    if column.kind == "money":
        egp = piasters_to_egp(value)
        return f"{egp:,.2f} ج.م" if for_pdf else egp

    if column.kind == "percent":
        num = round(float(value), 1)
        return f"{num}%" if for_pdf else num

    if isinstance(value, datetime):
        return format_cairo_timestamp(value)

    if isinstance(value, date):
        return value.isoformat()

    return value