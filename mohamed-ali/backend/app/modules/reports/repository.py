from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.reports.generators.formatting import now_cairo
from app.modules.reports.models import AuditLog, ReportExport
from app.modules.reports.schemas import AuditArea, ReportFormat, ReportType


class ReportsRepository:
    """
    طبقة الوصول لقاعدة البيانات لموديول التقارير وسجل الرقابة:
    - استعلامات قراءة فقط (Read-Only SELECT) من جداول الموديولات الأخرى.
    - كتابة في report_exports.
    - إضافة فقط (Append-Only INSERT) في audit_logs بدون أي UPDATE أو DELETE.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def line_exists(self, line_code: str) -> bool:
        """التحقق من وجود كود الخط (مثل '5' أو '14-2') لإرجاع 404 LINE_NOT_FOUND عند غيابه."""
        stmt = text("SELECT 1 FROM routes WHERE code = :code LIMIT 1")
        result = await self.session.execute(stmt, {"code": line_code})
        return result.scalar_one_or_none() is not None

    async def fetch_roster_rows(
        self,
        *,
        line: str | None,
        lang: str = "ar",
    ) -> list[dict[str, Any]]:
        """
        تقرير كشف الطلاب المشتركين (roster) حسب الوضع الحالي:
        الأعمدة: الخط، اسم الخط، الرقم الجامعي، الاسم، المحطة، ميعاد الركوب.
        """
        name_col = "r.name_ar" if lang == "ar" else "COALESCE(r.name_en, r.name_ar)"
        stop_col = "st.name_ar" if lang == "ar" else "COALESCE(st.name_en, st.name_ar)"

        stmt = text(f"""
            SELECT
                r.code AS line_code,
                {name_col} AS line_name,
                u.identifier AS student_id,
                u.name AS student_name,
                {stop_col} AS stop_name,
                ls.pickup_time AS pickup_time
            FROM subscriptions sub
            JOIN users u ON u.id = sub.student_id
            JOIN routes r ON r.id = sub.route_id
            LEFT JOIN stops st ON st.id = sub.stop_id
            LEFT JOIN line_stops ls ON ls.route_id = r.id AND ls.stop_id = sub.stop_id
            WHERE sub.status = 'active'
              AND (:line IS NULL OR r.code = :line)
            ORDER BY r.code ASC, ls.stop_order ASC NULLS LAST, u.identifier ASC
        """)
        result = await self.session.execute(stmt, {"line": line})
        return [dict(row) for row in result.mappings().all()]

    async def fetch_payments_rows(
        self,
        *,
        line: str | None,
        from_date: date,
        to_date: date,
        lang: str = "ar",
    ) -> list[dict[str, Any]]:
        """
        تقرير المدفوعات (payments):
        المبالغ تُجلب بالقرش (amount_piasters: int) وتُحوّل إلى جنيه في Excel/PDF فقط.
        """
        stmt = text("""
            SELECT
                p.paid_on AS paid_on,
                p.reference_number AS reference_number,
                u.identifier AS student_id,
                u.name AS student_name,
                r.code AS line_code,
                p.method AS method,
                p.amount_piasters AS amount_piasters,
                p.status AS status,
                rev.name AS reviewed_by
            FROM payments p
            JOIN subscriptions sub ON sub.id = p.subscription_id
            JOIN users u ON u.id = sub.student_id
            JOIN routes r ON r.id = sub.route_id
            LEFT JOIN users rev ON rev.id = p.reviewed_by
            WHERE p.paid_on BETWEEN :from_date AND :to_date
              AND (:line IS NULL OR r.code = :line)
            ORDER BY p.paid_on DESC, p.created_at DESC
        """)
        result = await self.session.execute(
            stmt,
            {"line": line, "from_date": from_date, "to_date": to_date},
        )
        return [dict(row) for row in result.mappings().all()]

    async def fetch_attendance_rows(
        self,
        *,
        line: str | None,
        from_date: date,
        to_date: date,
        lang: str = "ar",
    ) -> list[dict[str, Any]]:
        """
        تقرير الحضور اليومي (attendance):
        صف لكل خط في كل يوم تشغيل: المشتركين، ركبوا، قالوا مش رايحين، غابوا، ونسبة الحضور %.
        """
        name_col = "r.name_ar" if lang == "ar" else "COALESCE(r.name_en, r.name_ar)"

        stmt = text(f"""
            SELECT
                t.service_date AS service_date,
                r.code AS line_code,
                {name_col} AS line_name,
                COUNT(DISTINCT sub.student_id) AS subscribed_count,
                COUNT(DISTINCT CASE WHEN att.outcome IN ('rode', 'checked_out') THEN att.student_id END) AS rode_count,
                COUNT(DISTINCT CASE WHEN att.outcome = 'not_going' THEN att.student_id END) AS not_going_count,
                COUNT(DISTINCT CASE WHEN att.outcome = 'absent' THEN att.student_id END) AS absent_count,
                CASE
                    WHEN COUNT(DISTINCT sub.student_id) = 0 THEN 0.0
                    ELSE ROUND(
                        (COUNT(DISTINCT CASE WHEN att.outcome IN ('rode', 'checked_out') THEN att.student_id END)::numeric
                         / COUNT(DISTINCT sub.student_id)::numeric) * 100.0,
                        1
                    )
                END AS attendance_rate
            FROM trips t
            JOIN routes r ON r.id = t.route_id
            LEFT JOIN subscriptions sub
                ON sub.route_id = r.id
               AND sub.status = 'active'
            LEFT JOIN attendance att
                ON att.trip_id = t.id
               AND att.student_id = sub.student_id
            WHERE t.service_date BETWEEN :from_date AND :to_date
              AND (:line IS NULL OR r.code = :line)
            GROUP BY t.service_date, r.code, {name_col}
            ORDER BY t.service_date DESC, r.code ASC
        """)
        result = await self.session.execute(
            stmt,
            {"line": line, "from_date": from_date, "to_date": to_date},
        )
        return [dict(row) for row in result.mappings().all()]

    async def fetch_seat_occupancy_rows(
        self,
        *,
        line: str | None,
        from_date: date,
        to_date: date,
        lang: str = "ar",
    ) -> list[dict[str, Any]]:
        """
        تقرير إشغال المقاعد (seat_occupancy):
        الخط، الكراسي، المشتركين، الكراسي الفاضية، متوسط الركاب في اليوم، نسبة الإشغال %.
        """
        name_col = "r.name_ar" if lang == "ar" else "COALESCE(r.name_en, r.name_ar)"

        stmt = text(f"""
            WITH active_subs AS (
                SELECT route_id, COUNT(*) AS subscribed_count
                FROM subscriptions
                WHERE status = 'active'
                GROUP BY route_id
            ),
            daily_riders AS (
                SELECT
                    t.route_id,
                    t.service_date,
                    COUNT(DISTINCT CASE WHEN att.outcome IN ('rode', 'checked_out') THEN att.student_id END) AS day_riders
                FROM trips t
                LEFT JOIN attendance att ON att.trip_id = t.id
                WHERE t.service_date BETWEEN :from_date AND :to_date
                GROUP BY t.route_id, t.service_date
            ),
            avg_daily AS (
                SELECT
                    route_id,
                    ROUND(COALESCE(AVG(day_riders), 0)::numeric, 1) AS avg_daily_riders
                FROM daily_riders
                GROUP BY route_id
            )
            SELECT
                r.code AS line_code,
                {name_col} AS line_name,
                COALESCE(b.seats_total, 0) AS seats_total,
                COALESCE(s.subscribed_count, 0) AS subscribed_count,
                GREATEST(COALESCE(b.seats_total, 0) - COALESCE(s.subscribed_count, 0), 0) AS empty_seats,
                COALESCE(a.avg_daily_riders, 0.0) AS avg_daily_riders,
                CASE
                    WHEN COALESCE(b.seats_total, 0) = 0 THEN 0.0
                    ELSE ROUND(
                        (COALESCE(s.subscribed_count, 0)::numeric / b.seats_total::numeric) * 100.0,
                        1
                    )
                END AS occupancy_rate
            FROM routes r
            LEFT JOIN buses b ON b.id = r.bus_id
            LEFT JOIN active_subs s ON s.route_id = r.id
            LEFT JOIN avg_daily a ON a.route_id = r.id
            WHERE (:line IS NULL OR r.code = :line)
            ORDER BY r.code ASC
        """)
        result = await self.session.execute(
            stmt,
            {"line": line, "from_date": from_date, "to_date": to_date},
        )
        return [dict(row) for row in result.mappings().all()]

    async def create_report_export(
        self,
        *,
        requested_by: UUID,
        report_type: ReportType,
        file_format: ReportFormat,
        parameters: dict[str, Any],
    ) -> ReportExport:
        """إنشاء سجل تتبع لعملية التصدير في جدول report_exports."""
        record = ReportExport(
            requested_by=requested_by,
            report_type=report_type,
            file_format=file_format,
            status="processing",
            parameters=parameters,
        )
        self.session.add(record)
        await self.session.flush()
        return record

    async def complete_report_export(
        self,
        record: ReportExport,
        *,
        file_url: str | None = None,
        completed_at: datetime | None = None,
    ) -> ReportExport:
        """تحديث حالة التصدير إلى completed بعد نجاح التوليد."""
        record.status = "completed"
        record.file_url = file_url
        record.completed_at = completed_at or now_cairo()
        await self.session.flush()
        return record

    async def append_audit_log(
        self,
        *,
        actor_id: UUID | None,
        action: str,
        entity_name: str,
        entity_id: UUID | None = None,
        changes: dict[str, Any] | None = None,
        ip_address: str | None = None,
    ) -> AuditLog:
        """
        إضافة سطر جديد إلى سجل العمليات (Append-Only).
        ممنوع نهائياً إضافة أي دوال تعديل أو حذف على AuditLog.
        """
        entry = AuditLog(
            actor_id=actor_id,
            action=action,
            entity_name=entity_name,
            entity_id=entity_id,
            changes=changes,
            ip_address=ip_address,
        )
        self.session.add(entry)
        await self.session.flush()
        return entry

    async def list_audit_logs(
        self,
        *,
        area: AuditArea | None,
        page: int,
        page_size: int,
    ) -> tuple[list[dict[str, Any]], int]:
        """
        جلب سجل العمليات مرتباً من الأحدث للأقدم (GET /admin/audit) مع الفلترة بـ area والترقيم.
        """
        base_filter = []
        if area is not None:
            base_filter.append(AuditLog.entity_name == area)

        count_stmt = select(func.count(AuditLog.id)).where(*base_filter)
        total = int((await self.session.execute(count_stmt)).scalar_one())

        offset = (page - 1) * page_size
        query_stmt = text("""
            SELECT
                al.id AS audit_id,
                al.created_at AS at,
                al.action AS action,
                al.entity_name AS area,
                al.entity_id AS entity_id,
                al.changes AS changes,
                COALESCE(u.name, 'System') AS actor_name,
                u.identifier AS actor_identifier,
                u.role AS actor_role
            FROM audit_logs al
            LEFT JOIN users u ON u.id = al.actor_id
            WHERE (:area IS NULL OR al.entity_name = :area)
            ORDER BY al.created_at DESC
            LIMIT :limit OFFSET :offset
        """)
        rows = (
            await self.session.execute(
                query_stmt,
                {"area": area, "limit": page_size, "offset": offset},
            )
        ).mappings().all()

        return [dict(r) for r in rows], total