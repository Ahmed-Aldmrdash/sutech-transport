"use client";

import { useLocale, useTranslations } from "next-intl";
import { DataTable, type TableColumn } from "@/components/ui/table";
import type { Locale } from "@/i18n/routing";
import { formatCalendarDate, formatClockTime, formatMoney, formatNumber } from "@/lib/format";
import { ColumnKind, type Report, type ReportColumn, type ReportRow } from "../schema";

const END_ALIGNED: readonly ReportColumn["kind"][] = [
  ColumnKind.Number,
  ColumnKind.Money,
  ColumnKind.Percent,
];

function cellOf(column: ReportColumn, row: ReportRow, locale: Locale) {
  const value = row[column.key];
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    if (column.kind === ColumnKind.Money) return formatMoney(value, locale);
    if (column.kind === ColumnKind.Percent) return `${formatNumber(value, locale)}%`;
    return formatNumber(value, locale);
  }
  if (column.kind === ColumnKind.Date) return formatCalendarDate(value, locale);
  if (column.kind === ColumnKind.Time) return formatClockTime(value, locale);
  return <bdi>{value}</bdi>;
}

/** The rows of one page of the report, each column written as its kind says. */
export function ReportTable({ report }: { report: Report }) {
  const t = useTranslations("desk.reports");
  const locale = useLocale() as Locale;
  const columns: TableColumn<{ key: string; row: ReportRow }>[] = report.columns.map((column) => ({
    key: column.key,
    header: column.label,
    align: END_ALIGNED.includes(column.kind) ? "end" : "start",
    cell: ({ row }) => cellOf(column, row, locale),
  }));
  const offset = (report.page - 1) * report.page_size;
  return (
    <DataTable
      caption={report.title}
      columns={columns}
      rows={report.rows.map((row, index) => ({ key: String(offset + index), row }))}
      getRowKey={(item) => item.key}
      empty={<p className="text-body-sm text-ink-muted">{t("empty")}</p>}
    />
  );
}
