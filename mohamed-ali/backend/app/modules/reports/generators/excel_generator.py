from __future__ import annotations
from io import BytesIO
from typing import Any, Literal

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from app.modules.reports.generators.formatting import (
    format_cairo_timestamp,
    format_cell_for_export,
)
from app.modules.reports.schemas import (
    ReportAppliedFilters,
    ReportColumnSchema,
    ReportSummaryItem,
)


def generate_excel_report(
    *,
    title: str,
    columns: list[ReportColumnSchema],
    rows: list[dict[str, Any]],
    filters: ReportAppliedFilters,
    summary: list[ReportSummaryItem],
    lang: Literal["ar", "en"] = "ar",
) -> bytes:
    """توليد ملف Excel (.xlsx) منسق بالكامل مع تحويل القروش إلى جنيه وتوقيت القاهرة."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Report"
    ws.views.sheetView[0].rightToLeft = lang == "ar"

    header_fill = PatternFill(start_color="0F2942", end_color="0F2942", fill_type="solid")
    sub_fill = PatternFill(start_color="EEF3F8", end_color="EEF3F8", fill_type="solid")
    zebra_fill = PatternFill(start_color="F9FBFD", end_color="F9FBFD", fill_type="solid")

    title_font = Font(name="Calibri", size=14, bold=True, color="0F2942")
    meta_font = Font(name="Calibri", size=10, color="334155")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    body_font = Font(name="Calibri", size=10, color="0F172A")
    summary_font = Font(name="Calibri", size=10, bold=True, color="0F2942")

    thin_side = Side(border_style="thin", color="CBD5E1")
    cell_border = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)

    total_cols = max(len(columns), 1)
    last_col_letter = get_column_letter(total_cols)

    # 1. عنوان التقرير والفلاتر ووقت الإصدار
    ws.merge_cells(f"A1:{last_col_letter}1")
    ws["A1"] = f"SUtech Smart Transport - {title}"
    ws["A1"].font = title_font
    ws["A1"].alignment = Alignment(horizontal="right" if lang == "ar" else "left", vertical="center")
    ws.row_dimensions[1].height = 28

    line_label = filters.line or ("الكل" if lang == "ar" else "All")
    period_label = (
        f"{filters.from_date or '-'} → {filters.to_date or '-'}"
        if (filters.from_date or filters.to_date)
        else ("اليوم" if lang == "ar" else "Today")
    )
    generated_str = format_cairo_timestamp()

    ws.merge_cells(f"A2:{last_col_letter}2")
    ws["A2"] = (
        f"الخط: {line_label}  |  الفترة: {period_label}  |  تاريخ الإصدار (توقيت القاهرة): {generated_str}"
        if lang == "ar"
        else f"Line: {line_label}  |  Period: {period_label}  |  Generated (Cairo): {generated_str}"
    )
    ws["A2"].font = meta_font
    ws["A2"].fill = sub_fill
    ws["A2"].alignment = Alignment(horizontal="right" if lang == "ar" else "left", vertical="center")
    ws.row_dimensions[2].height = 22

    # 2. صف رؤوس الأعمدة (Row 4)
    header_row_idx = 4
    ws.row_dimensions[header_row_idx].height = 24
    for col_idx, col in enumerate(columns, start=1):
        cell = ws.cell(row=header_row_idx, column=col_idx, value=col.label)
        cell.font = header_font
        cell.fill = header_fill
        cell.border = cell_border
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    # 3. صفوف البيانات
    current_row = header_row_idx + 1
    for row_offset, row_data in enumerate(rows):
        ws.row_dimensions[current_row].height = 20
        for col_idx, col in enumerate(columns, start=1):
            raw_val = row_data.get(col.key)
            formatted_val = format_cell_for_export(raw_val, col, for_pdf=False)
            cell = ws.cell(row=current_row, column=col_idx, value=formatted_val)
            cell.font = body_font
            cell.border = cell_border
            if row_offset % 2 == 1:
                cell.fill = zebra_fill

            if col.kind == "money":
                cell.number_format = '#,##0.00 "EGP"'
                cell.alignment = Alignment(horizontal="right", vertical="center")
            elif col.kind in ("number", "percent"):
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(
                    horizontal="right" if lang == "ar" else "left",
                    vertical="center",
                )
        current_row += 1

    # 4. قسم الملخص (Summary) في أسفل الجدول
    if summary:
        current_row += 1
        for item in summary:
            ws.cell(row=current_row, column=1, value=item.label).font = summary_font
            ws.cell(row=current_row, column=1).fill = sub_fill
            ws.cell(row=current_row, column=1).border = cell_border

            val_cell = ws.cell(row=current_row, column=2, value=item.value)
            val_cell.font = summary_font
            val_cell.border = cell_border
            current_row += 1

    # ضبط عرض الأعمدة تلقائياً
    for col_idx, col in enumerate(columns, start=1):
        col_letter = get_column_letter(col_idx)
        max_len = max(
            [len(str(col.label))]
            + [len(str(r.get(col.key, ""))) for r in rows[:200]]
        )
        ws.column_dimensions[col_letter].width = min(max(max_len + 6, 14), 40)

    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()