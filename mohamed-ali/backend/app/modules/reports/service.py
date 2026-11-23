from __future__ import annotations

import base64
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Literal
from uuid import UUID

from app.modules.reports.generators import (
    MAX_PDF_ROWS,
    build_export_filename,
    generate_excel_report,
    generate_pdf_report,
    now_cairo,
    piasters_to_egp,
)
from app.modules.reports.repository import ReportsRepository
from app.modules.reports.schemas import (
    AuditActorSchema,
    AuditArea,
    AuditLogItemResponse,
    AuditLogListResponse,
    AuditQueryParams,
    ReportAppliedFilters,
    ReportCatalogItem,
    ReportCatalogResponse,
    ReportColumnSchema,
    ReportJsonResponse,
    ReportQueryParams,
    ReportSummaryItem,
    ReportType,
)


class ReportsDomainError(Exception):
    """خطأ قياسي لموديول التقارير يطابق عقد {"code": "UPPER_SNAKE_CASE", "message": "..."}."""

    def __init__(self, status_code: int, code: str, message: str) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        super().__init__(f"{code}: {message}")


@dataclass(frozen=True)
class ExportedFileResult:
    content: bytes
    filename: str
    media_type: str


# مصفوفة الصلاحيات المعتمدة في العقد الرسمي
ROLE_REPORT_PERMISSIONS: dict[str, set[ReportType]] = {
    "super_admin": {"roster", "payments", "attendance", "seat_occupancy"},
    "transport_admin": {"roster", "attendance", "seat_occupancy"},
    "finance": {"payments", "seat_occupancy"},
    "secretary_general": {"roster", "payments", "attendance", "seat_occupancy"},
}

VALID_REPORT_TYPES: set[str] = {"roster", "payments", "attendance", "seat_occupancy"}
MAX_ATTENDANCE_DAYS = 31


class ReportsService:
    """طبقة منطق الأعمال والصلاحيات وتنسيق البيانات لموديول التقارير وسجل الرقابة."""

    def __init__(self, repo: ReportsRepository) -> None:
        self.repo = repo

    # ------------------------------------------------------------------
    # 1. كتالوج التقارير المسموحة للدور الحالي (GET /admin/reports)
    # ------------------------------------------------------------------
    def get_catalog_for_role(
        self,
        *,
        role: str,
        lang: Literal["ar", "en"] = "ar",
    ) -> ReportCatalogResponse:
        allowed = ROLE_REPORT_PERMISSIONS.get(role)
        if not allowed:
            raise ReportsDomainError(
                status_code=403,
                code="FORBIDDEN",
                message="You do not have permission to access administrative reports.",
            )

        catalog_defs: list[tuple[ReportType, str, str, str, str, bool]] = [
            (
                "roster",
                "كشف الطلاب المشتركين",
                "Subscribed Students Roster",
                "قائمة الطلاب النشطين على كل خط ومحطاتهم ومواعيد ركوبهم.",
                "Active subscribed students per line with stops and pickup times.",
                False,
            ),
            (
                "payments",
                "تقرير المدفوعات والتحصيل",
                "Payments & Collections Report",
                "سجل الإيصالات والمدفوعات المعتمدة والمرفوضة وتحت المراجعة.",
                "Log of receipts and payments across statuses and payment methods.",
                True,
            ),
            (
                "attendance",
                "تقرير الحضور والغياب اليومي",
                "Daily Attendance Report",
                "إحصائيات الركوب والغياب وبلاغات عدم الحضور لكل خط يومياً (حد أقصى 31 يوماً).",
                "Daily boarding, absence, and not-going counts per line (max 31 days).",
                True,
            ),
            (
                "seat_occupancy",
                "تقرير إشغال المقاعد",
                "Seat Occupancy Report",
                "مقارنة سعة الباصات بعدد المشتركين ومتوسط الركاب اليومي ونسبة الإشغال.",
                "Bus capacity vs active subscriptions, average daily riders, and occupancy rate.",
                True,
            ),
        ]

        items = [
            ReportCatalogItem(
                type=r_type,
                title=title_ar if lang == "ar" else title_en,
                description=desc_ar if lang == "ar" else desc_en,
                uses_period=uses_period,
            )
            for r_type, title_ar, title_en, desc_ar, desc_en, uses_period in catalog_defs
            if r_type in allowed
        ]
        return ReportCatalogResponse(items=items)

    # ------------------------------------------------------------------
    # 2. تنفيذ التقرير (JSON أو تصدير XLSX / PDF)
    # ------------------------------------------------------------------
    async def generate_report(
        self,
        *,
        actor_id: UUID,
        actor_role: str,
        raw_report_type: str,
        params: ReportQueryParams,
        lang: Literal["ar", "en"] = "ar",
        ip_address: str | None = None,
    ) -> ReportJsonResponse | ExportedFileResult:
        # الخطوة 1: فحص الصلاحيات أولاً (RBAC - 403)
        allowed_for_role = ROLE_REPORT_PERMISSIONS.get(actor_role)
        if not allowed_for_role:
            raise ReportsDomainError(
                status_code=403,
                code="FORBIDDEN",
                message="You do not have permission to access reports.",
            )

        # الخطوة 2: التحقق من وجود نوع التقرير (404) ثم صلاحية الدور على هذا النوع بالتحديد (403)
        if raw_report_type not in VALID_REPORT_TYPES:
            raise ReportsDomainError(
                status_code=404,
                code="REPORT_NOT_FOUND",
                message=f"Unknown report type '{raw_report_type}'.",
            )

        report_type: ReportType = raw_report_type  # type: ignore[assignment]
        if report_type not in allowed_for_role:
            raise ReportsDomainError(
                status_code=403,
                code="FORBIDDEN",
                message=f"Role '{actor_role}' is not allowed to access '{report_type}' report.",
            )

        # الخطوة 3: التحقق من وجود الخط إذا تم تمرير فلتر line (404)
        normalized_line = params.line.strip() if params.line else None
        if normalized_line:
            exists = await self.repo.line_exists(normalized_line)
            if not exists:
                raise ReportsDomainError(
                    status_code=404,
                    code="LINE_NOT_FOUND",
                    message=f"Line '{normalized_line}' does not exist.",
                )

        # الخطوة 4: التحقق من صحة نطاق التاريخ (422 INVALID_RANGE)
        if params.from_date and params.to_date and params.from_date > params.to_date:
            raise ReportsDomainError(
                status_code=422,
                code="INVALID_RANGE",
                message="'from' date must not be after 'to' date.",
            )

        # ضبط التواريخ الافتراضية للتقارير المعتمدة على فترة
        today = now_cairo().date()
        if report_type == "roster":
            effective_from: date | None = None
            effective_to: date | None = None
        else:
            effective_to = params.to_date or today
            effective_from = params.from_date or (effective_to - timedelta(days=30))

        # الخطوة 5: التحقق من الحد الأقصى لفترة تقرير الحضور (422 REPORT_RANGE_TOO_LONG)
        if (
            report_type == "attendance"
            and effective_from is not None
            and effective_to is not None
            and (effective_to - effective_from).days > MAX_ATTENDANCE_DAYS
        ):
            raise ReportsDomainError(
                status_code=422,
                code="REPORT_RANGE_TOO_LONG",
                message=f"Attendance report date range cannot exceed {MAX_ATTENDANCE_DAYS} days.",
            )

        # الخطوة 6: جلب البيانات وبناء الأعمدة والملخص الموحد
        title = self._get_report_title(report_type, lang)
        columns = self._get_report_columns(report_type, lang)
        all_rows = await self._fetch_rows(
            report_type=report_type,
            line=normalized_line,
            from_date=effective_from,
            to_date=effective_to,
            lang=lang,
        )

        applied_filters = ReportAppliedFilters(
            line=normalized_line,
            from_date=effective_from,
            to_date=effective_to,
        )

        # إذا كان الطلب JSON: نُرجع الصفحة المطلوبة + الملخص بالقيم الداخلية (piasters)
        if params.format == "json":
            total = len(all_rows)
            start_idx = (params.page - 1) * params.page_size
            end_idx = start_idx + params.page_size
            paged_rows = all_rows[start_idx:end_idx]
            json_summary = self._build_summary(
                report_type=report_type,
                rows=all_rows,
                lang=lang,
                for_export=False,
            )
            return ReportJsonResponse(
                type=report_type,
                title=title,
                columns=columns,
                rows=paged_rows,
                total=total,
                page=params.page,
                page_size=params.page_size,
                filters=applied_filters,
                summary=json_summary,
                generated_at=now_cairo(),
            )

        # الخطوة 7: التحقق من حد 2000 صف قبل توليد PDF (422 REPORT_TOO_LARGE_FOR_PDF)
        if params.format == "pdf" and len(all_rows) > MAX_PDF_ROWS:
            raise ReportsDomainError(
                status_code=422,
                code="REPORT_TOO_LARGE_FOR_PDF",
                message=f"PDF export supports up to {MAX_PDF_ROWS} rows (got {len(all_rows)}). Use XLSX instead.",
            )

        # تجهيز ملخص التصدير (تحويل أي مبالغ مالية من قرش إلى جنيه EGP)
        export_summary = self._build_summary(
            report_type=report_type,
            rows=all_rows,
            lang=lang,
            for_export=True,
        )
        filename = build_export_filename(
            report_type=report_type,
            file_format=params.format,
            filters=applied_filters,
            reference_date=today,
        )

        # تسجيل عملية التصدير في report_exports
        export_record = await self.repo.create_report_export(
            requested_by=actor_id,
            report_type=report_type,
            file_format=params.format,
            parameters={
                "line": normalized_line,
                "from": effective_from.isoformat() if effective_from else None,
                "to": effective_to.isoformat() if effective_to else None,
                "lang": lang,
                "rows_count": len(all_rows),
            },
        )

        if params.format == "xlsx":
            file_bytes = generate_excel_report(
                title=title,
                columns=columns,
                rows=all_rows,
                filters=applied_filters,
                summary=export_summary,
                lang=lang,
            )
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        else:
            file_bytes = generate_pdf_report(
                title=title,
                columns=columns,
                rows=all_rows,
                filters=applied_filters,
                summary=export_summary,
                lang=lang,
                logo_data_uri=self._load_official_logo_data_uri(),
            )
            media_type = "application/pdf"

        await self.repo.complete_report_export(export_record)

        # تسجيل التصدير في سجل الرقابة Append-Only (AuditLog)
        await self.repo.append_audit_log(
            actor_id=actor_id,
            action=f"export_report_{params.format}",
            entity_name="reports",
            entity_id=export_record.id,
            changes={
                "report_type": report_type,
                "file_format": params.format,
                "filename": filename,
                "filters": {
                    "line": normalized_line,
                    "from": effective_from.isoformat() if effective_from else None,
                    "to": effective_to.isoformat() if effective_to else None,
                },
                "rows_count": len(all_rows),
            },
            ip_address=ip_address,
        )

        return ExportedFileResult(
            content=file_bytes,
            filename=filename,
            media_type=media_type,
        )

    # ------------------------------------------------------------------
    # 3. سجل العمليات والرقابة (GET /admin/audit - super_admin فقط)
    # ------------------------------------------------------------------
    async def list_audit_logs(
        self,
        *,
        actor_role: str,
        params: AuditQueryParams,
    ) -> AuditLogListResponse:
        if actor_role != "super_admin":
            raise ReportsDomainError(
                status_code=403,
                code="FORBIDDEN",
                message="Only super_admin can access the audit log.",
            )

        raw_items, total = await self.repo.list_audit_logs(
            area=params.area,
            page=params.page,
            page_size=params.page_size,
        )

        items: list[AuditLogItemResponse] = []
        for row in raw_items:
            changes = row.get("changes") or {}
            target = (
                changes.get("filename")
                or changes.get("reference")
                or (str(row["entity_id"]) if row.get("entity_id") else None)
            )
            detail = changes.get("detail") or changes.get("note")

            # ضمان أن area تنتمي للقيم المعتمدة
            area_val: AuditArea = (
                row["area"]
                if row.get("area") in AuditArea.__args__  # type: ignore[attr-defined]
                else "reports"
            )

            items.append(
                AuditLogItemResponse(
                    audit_id=row["audit_id"],
                    at=row["at"],
                    actor=AuditActorSchema(
                        name=row.get("actor_name") or "System",
                        identifier=row.get("actor_identifier"),
                        role=row.get("actor_role"),
                    ),
                    action=row["action"],
                    area=area_val,
                    target=target,
                    detail=detail,
                )
            )

        return AuditLogListResponse(items=items, total=total)

    # ------------------------------------------------------------------
    # دوال مساعدة داخلية لبناء الأعمدة والملخصات وتحميل الشعار
    # ------------------------------------------------------------------
    async def _fetch_rows(
        self,
        *,
        report_type: ReportType,
        line: str | None,
        from_date: date | None,
        to_date: date | None,
        lang: str,
    ) -> list[dict[str, Any]]:
        if report_type == "roster":
            return await self.repo.fetch_roster_rows(line=line, lang=lang)
        if report_type == "payments":
            assert from_date is not None and to_date is not None
            return await self.repo.fetch_payments_rows(
                line=line, from_date=from_date, to_date=to_date, lang=lang
            )
        if report_type == "attendance":
            assert from_date is not None and to_date is not None
            return await self.repo.fetch_attendance_rows(
                line=line, from_date=from_date, to_date=to_date, lang=lang
            )
        assert from_date is not None and to_date is not None
        return await self.repo.fetch_seat_occupancy_rows(
            line=line, from_date=from_date, to_date=to_date, lang=lang
        )

    def _get_report_title(self, report_type: ReportType, lang: str) -> str:
        titles: dict[ReportType, tuple[str, str]] = {
            "roster": ("كشف الطلاب المشتركين", "Subscribed Students Roster"),
            "payments": ("تقرير المدفوعات والتحصيل", "Payments & Collections Report"),
            "attendance": ("تقرير الحضور والغياب اليومي", "Daily Attendance Report"),
            "seat_occupancy": ("تقرير إشغال المقاعد", "Seat Occupancy Report"),
        }
        ar, en = titles[report_type]
        return ar if lang == "ar" else en

    def _get_report_columns(
        self, report_type: ReportType, lang: str
    ) -> list[ReportColumnSchema]:
        is_ar = lang == "ar"
        if report_type == "roster":
            return [
                ReportColumnSchema(key="line_code", label="الخط" if is_ar else "Line", kind="text"),
                ReportColumnSchema(key="line_name", label="اسم الخط" if is_ar else "Line Name", kind="text"),
                ReportColumnSchema(key="student_id", label="الرقم الجامعي" if is_ar else "Student ID", kind="text"),
                ReportColumnSchema(key="student_name", label="الاسم" if is_ar else "Student Name", kind="text"),
                ReportColumnSchema(key="stop_name", label="المحطة" if is_ar else "Stop", kind="text"),
                ReportColumnSchema(key="pickup_time", label="ميعاد الركوب" if is_ar else "Pickup Time", kind="time"),
            ]
        if report_type == "payments":
            return [
                ReportColumnSchema(key="paid_on", label="التاريخ" if is_ar else "Date", kind="date"),
                ReportColumnSchema(key="reference_number", label="المرجع" if is_ar else "Reference", kind="text"),
                ReportColumnSchema(key="student_id", label="الرقم الجامعي" if is_ar else "Student ID", kind="text"),
                ReportColumnSchema(key="student_name", label="الاسم" if is_ar else "Student Name", kind="text"),
                ReportColumnSchema(key="line_code", label="الخط" if is_ar else "Line", kind="text"),
                ReportColumnSchema(key="method", label="الطريقة" if is_ar else "Method", kind="text"),
                ReportColumnSchema(key="amount_piasters", label="المبلغ" if is_ar else "Amount", kind="money"),
                ReportColumnSchema(key="status", label="الحالة" if is_ar else "Status", kind="text"),
                ReportColumnSchema(key="reviewed_by", label="المراجع" if is_ar else "Reviewed By", kind="text"),
            ]
        if report_type == "attendance":
            return [
                ReportColumnSchema(key="service_date", label="التاريخ" if is_ar else "Date", kind="date"),
                ReportColumnSchema(key="line_code", label="الخط" if is_ar else "Line", kind="text"),
                ReportColumnSchema(key="line_name", label="اسم الخط" if is_ar else "Line Name", kind="text"),
                ReportColumnSchema(key="subscribed_count", label="المشتركين" if is_ar else "Subscribed", kind="number"),
                ReportColumnSchema(key="rode_count", label="ركبوا" if is_ar else "Rode", kind="number"),
                ReportColumnSchema(key="not_going_count", label="مش رايحين" if is_ar else "Not Going", kind="number"),
                ReportColumnSchema(key="absent_count", label="غابوا" if is_ar else "Absent", kind="number"),
                ReportColumnSchema(key="attendance_rate", label="نسبة الحضور %" if is_ar else "Attendance %", kind="percent"),
            ]
        return [
            ReportColumnSchema(key="line_code", label="الخط" if is_ar else "Line", kind="text"),
            ReportColumnSchema(key="line_name", label="اسم الخط" if is_ar else "Line Name", kind="text"),
            ReportColumnSchema(key="seats_total", label="الكراسي" if is_ar else "Total Seats", kind="number"),
            ReportColumnSchema(key="subscribed_count", label="المشتركين" if is_ar else "Subscribed", kind="number"),
            ReportColumnSchema(key="empty_seats", label="الكراسي الفاضية" if is_ar else "Empty Seats", kind="number"),
            ReportColumnSchema(key="avg_daily_riders", label="متوسط الركاب/يوم" if is_ar else "Avg Daily Riders", kind="number"),
            ReportColumnSchema(key="occupancy_rate", label="نسبة الإشغال %" if is_ar else "Occupancy %", kind="percent"),
        ]

    def _build_summary(
        self,
        *,
        report_type: ReportType,
        rows: list[dict[str, Any]],
        lang: str,
        for_export: bool,
    ) -> list[ReportSummaryItem]:
        is_ar = lang == "ar"
        if report_type == "roster":
            distinct_lines = len({r.get("line_code") for r in rows if r.get("line_code")})
            return [
                ReportSummaryItem(
                    label="إجمالي الطلاب المشتركين" if is_ar else "Total Subscribed Students",
                    value=len(rows),
                ),
                ReportSummaryItem(
                    label="عدد الخطوط" if is_ar else "Active Lines",
                    value=distinct_lines,
                ),
            ]

        if report_type == "payments":
            approved_piasters = sum(
                int(r.get("amount_piasters") or 0)
                for r in rows
                if r.get("status") == "approved"
            )
            pending_piasters = sum(
                int(r.get("amount_piasters") or 0)
                for r in rows
                if r.get("status") == "pending_review"
            )
            if for_export:
                approved_val: int | float | str = f"{piasters_to_egp(approved_piasters):,.2f} EGP"
                pending_val: int | float | str = f"{piasters_to_egp(pending_piasters):,.2f} EGP"
            else:
                approved_val = approved_piasters
                pending_val = pending_piasters

            return [
                ReportSummaryItem(
                    label="إجمالي العمليات" if is_ar else "Total Transactions",
                    value=len(rows),
                ),
                ReportSummaryItem(
                    label="إجمالي المعتمد" if is_ar else "Total Approved",
                    value=approved_val,
                ),
                ReportSummaryItem(
                    label="تحت المراجعة" if is_ar else "Pending Review",
                    value=pending_val,
                ),
            ]

        if report_type == "attendance":
            total_rode = sum(int(r.get("rode_count") or 0) for r in rows)
            total_absent = sum(int(r.get("absent_count") or 0) for r in rows)
            total_not_going = sum(int(r.get("not_going_count") or 0) for r in rows)
            return [
                ReportSummaryItem(label="إجمالي الركاب" if is_ar else "Total Rode", value=total_rode),
                ReportSummaryItem(label="إجمالي الغياب" if is_ar else "Total Absent", value=total_absent),
                ReportSummaryItem(label="مش رايحين" if is_ar else "Not Going", value=total_not_going),
            ]

        total_seats = sum(int(r.get("seats_total") or 0) for r in rows)
        total_sub = sum(int(r.get("subscribed_count") or 0) for r in rows)
        overall_rate = round((total_sub / total_seats) * 100.0, 1) if total_seats > 0 else 0.0
        return [
            ReportSummaryItem(label="إجمالي المقاعد" if is_ar else "Total Seats", value=total_seats),
            ReportSummaryItem(label="إجمالي المشتركين" if is_ar else "Total Subscribed", value=total_sub),
            ReportSummaryItem(label="نسبة الإشغال الكلية" if is_ar else "Overall Occupancy", value=f"{overall_rate}%"),
        ]

    @staticmethod
    def _load_official_logo_data_uri() -> str | None:
        """محاولة قراءة شعار الجامعة الرسمي من مجلد الأصول وتحويله إلى Data URI للـ PDF."""
        candidate_paths = [
            Path("app/assets/sutech_logo.png"),
            Path("app/static/sutech_logo.png"),
        ]
        for path in candidate_paths:
            if path.is_file():
                encoded = base64.b64encode(path.read_bytes()).decode("ascii")
                return f"data:image/png;base64,{encoded}"
        return None