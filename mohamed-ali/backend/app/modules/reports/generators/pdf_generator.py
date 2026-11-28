from __future__ import annotations

import html
from typing import Any, Literal

from weasyprint import HTML

from app.modules.reports.generators.formatting import (
    format_cairo_timestamp,
    format_cell_for_export,
)
from app.modules.reports.schemas import (
    ReportAppliedFilters,
    ReportColumnSchema,
    ReportSummaryItem,
)

MAX_PDF_ROWS = 2000


def generate_pdf_report(
    *,
    title: str,
    columns: list[ReportColumnSchema],
    rows: list[dict[str, Any]],
    filters: ReportAppliedFilters,
    summary: list[ReportSummaryItem],
    lang: Literal["ar", "en"] = "ar",
    logo_data_uri: str | None = None,
) -> bytes:
    """
    توليد ملف PDF يدعم العربية (RTL) بالشعار الرسمي والفلاتر وتوقيت القاهرة.
    يرفض أكثر من 2,000 صف لحماية الذاكرة ومطابقة العقد.
    """
    if len(rows) > MAX_PDF_ROWS:
        raise ValueError(f"REPORT_TOO_LARGE_FOR_PDF: row count ({len(rows)}) exceeds {MAX_PDF_ROWS}.")

    direction = "rtl" if lang == "ar" else "ltr"
    text_align = "right" if lang == "ar" else "left"
    generated_str = format_cairo_timestamp()

    line_label = html.escape(filters.line or ("الكل" if lang == "ar" else "All"))
    period_label = (
        f"{filters.from_date or '-'} → {filters.to_date or '-'}"
        if (filters.from_date or filters.to_date)
        else ("اليوم" if lang == "ar" else "Today")
    )

    logo_html = (
        f'<img src="{html.escape(logo_data_uri)}" alt="SUtech Logo" class="logo" />'
        if logo_data_uri
        else '<div class="logo-badge">SUtech Transport</div>'
    )

    summary_cards_html = "".join(
        f"""
        <div class="summary-card">
            <div class="summary-label">{html.escape(str(item.label))}</div>
            <div class="summary-value">{html.escape(str(item.value))}</div>
        </div>
        """
        for item in summary
    )

    headers_html = "".join(
        f"<th>{html.escape(col.label)}</th>" for col in columns
    )

    body_rows_parts: list[str] = []
    for row in rows:
        cells = []
        for col in columns:
            formatted = format_cell_for_export(row.get(col.key), col, for_pdf=True)
            css_class = "num" if col.kind in ("money", "number", "percent") else ""
            cells.append(f'<td class="{css_class}">{html.escape(str(formatted))}</td>')
        body_rows_parts.append(f"<tr>{''.join(cells)}</tr>")

    empty_msg = "لا توجد بيانات مطابقة للفلاتر المحددة" if lang == "ar" else "No records found"
    table_body_html = (
        "".join(body_rows_parts)
        if body_rows_parts
        else f'<tr><td colspan="{max(len(columns), 1)}" class="empty">{empty_msg}</td></tr>'
    )

    html_doc = f"""<!DOCTYPE html>
<html lang="{lang}" dir="{direction}">
<head>
<meta charset="UTF-8" />
<style>
  @page {{
    size: A4 landscape;
    margin: 14mm;
  }}
  body {{
    font-family: 'Cairo', 'IBM Plex Sans Arabic', 'DejaVu Sans', sans-serif;
    direction: {direction};
    text-align: {text_align};
    color: #0f172a;
    font-size: 10pt;
    margin: 0;
  }}
  .header {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #0f2942;
    padding-bottom: 10px;
    margin-bottom: 12px;
  }}
  .logo {{
    height: 44px;
  }}
  .logo-badge {{
    background: #0f2942;
    color: #ffffff;
    font-weight: bold;
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 12pt;
  }}
  .report-title {{
    font-size: 15pt;
    font-weight: bold;
    color: #0f2942;
    margin: 0;
  }}
  .meta-bar {{
    background: #f1f5f9;
    padding: 8px 12px;
    border-radius: 6px;
    margin-bottom: 12px;
    font-size: 9pt;
    color: #334155;
  }}
  .summary-grid {{
    display: flex;
    gap: 10px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }}
  .summary-card {{
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 8px 12px;
    min-width: 120px;
  }}
  .summary-label {{
    font-size: 8.5pt;
    color: #475569;
  }}
  .summary-value {{
    font-size: 11pt;
    font-weight: bold;
    color: #0f2942;
  }}
  table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
  }}
  th {{
    background: #0f2942;
    color: #ffffff;
    padding: 7px 6px;
    border: 1px solid #0f2942;
    text-align: center;
  }}
  td {{
    padding: 6px;
    border: 1px solid #cbd5e1;
  }}
  tr:nth-child(even) td {{
    background: #f8fafc;
  }}
  td.num {{
    text-align: center;
    font-variant-numeric: tabular-nums;
  }}
  td.empty {{
    text-align: center;
    padding: 16px;
    color: #64748b;
  }}
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="report-title">{html.escape(title)}</h1>
      <div style="font-size: 9pt; color: #64748b;">نظام النقل الذكي - جامعة SUtech</div>
    </div>
    {logo_html}
  </div>

  <div class="meta-bar">
    <strong>الخط:</strong> {line_label} &nbsp;|&nbsp;
    <strong>الفترة:</strong> {html.escape(period_label)} &nbsp;|&nbsp;
    <strong>وقت الإصدار (توقيت القاهرة):</strong> {html.escape(generated_str)}
  </div>

  <div class="summary-grid">{summary_cards_html}</div>

  <table>
    <thead><tr>{headers_html}</tr></thead>
    <tbody>{table_body_html}</tbody>
  </table>
</body>
</html>
"""
    return HTML(string=html_doc).write_pdf()