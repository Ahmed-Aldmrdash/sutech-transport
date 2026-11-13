import { z } from "zod";
import { isoDateTime } from "@/lib/api/iso-datetime";
import { lineSummarySchema } from "@/features/lines/schema";
import { calendarDateSchema } from "@/features/subscriptions/schema";
import { Role } from "@/lib/auth/roles";

/**
 * Office reports (agreement, "Report export (Excel and PDF)"). One endpoint per report type
 * returns it on screen (`format=json`, paged) or as a file (`xlsx` / `pdf`) with the same
 * filter and the same numbers. The server builds the rows in the request's language, so the
 * screen, the Excel file and the PDF always agree.
 */

export const ReportType = {
  Roster: "roster",
  Payments: "payments",
  Attendance: "attendance",
  SeatOccupancy: "seat_occupancy",
} as const;
export type ReportType = (typeof ReportType)[keyof typeof ReportType];
export const REPORT_TYPES = [
  ReportType.Roster,
  ReportType.Payments,
  ReportType.Attendance,
  ReportType.SeatOccupancy,
] as const;

/** Who may open each report (the super admin may open all). Checked by the server too. */
const REPORT_ACCESS: Record<ReportType, readonly Role[]> = {
  [ReportType.Roster]: [Role.Transport, Role.Finance, Role.SecretaryGeneral],
  [ReportType.Payments]: [Role.Finance, Role.SecretaryGeneral],
  [ReportType.Attendance]: [Role.Transport, Role.SecretaryGeneral],
  [ReportType.SeatOccupancy]: [Role.Transport, Role.Finance, Role.SecretaryGeneral],
};

export function canSeeReport(role: Role, type: ReportType): boolean {
  return role === Role.SuperAdmin || REPORT_ACCESS[type].includes(role);
}

export const ReportFormat = {
  Json: "json",
  Xlsx: "xlsx",
  Pdf: "pdf",
} as const;
export type ReportFormat = (typeof ReportFormat)[keyof typeof ReportFormat];
const REPORT_FORMATS = [ReportFormat.Json, ReportFormat.Xlsx, ReportFormat.Pdf] as const;
export type ReportFileFormat = typeof ReportFormat.Xlsx | typeof ReportFormat.Pdf;

export const ReportErrorCode = {
  /** `to` is before `from`. */
  InvalidRange: "INVALID_RANGE",
  /** Attendance covers at most a month at a time. */
  RangeTooLong: "REPORT_RANGE_TOO_LONG",
  /** Too many rows for a readable PDF: pick one line or a shorter period, or use Excel. */
  TooLargeForPdf: "REPORT_TOO_LARGE_FOR_PDF",
} as const;
export type ReportErrorCode = (typeof ReportErrorCode)[keyof typeof ReportErrorCode];

/** Attendance: at most this many days per report. */
export const ATTENDANCE_MAX_DAYS = 31;
/** A PDF holds at most this many rows; Excel has no limit. */
export const PDF_MAX_ROWS = 2000;
const PAGE_SIZE_MAX = 200;

/**
 * How a column's values are written: money in piasters on screen (pounds in the files), dates
 * as "YYYY-MM-DD", times as "HH:MM" Egypt time, percent as 0 to 100.
 */
export const ColumnKind = {
  Text: "text",
  Number: "number",
  Money: "money",
  Date: "date",
  Time: "time",
  Percent: "percent",
} as const;
export type ColumnKind = (typeof ColumnKind)[keyof typeof ColumnKind];
const COLUMN_KINDS = Object.values(ColumnKind) as [ColumnKind, ...ColumnKind[]];

export const reportColumnSchema = z.object({
  key: z.string(),
  /** In the request's language. */
  label: z.string(),
  kind: z.enum(COLUMN_KINDS),
});
export type ReportColumn = z.infer<typeof reportColumnSchema>;

const reportCellSchema = z.union([z.string(), z.number(), z.null()]);
export type ReportCell = z.infer<typeof reportCellSchema>;
export type ReportRow = Record<string, ReportCell>;

export const reportCatalogSchema = z.object({
  /** Only the reports the caller may open. */
  items: z.array(
    z.object({
      type: z.enum(REPORT_TYPES),
      title: z.string(),
      description: z.string(),
      /** Uses the `from` / `to` period (all but the roster). */
      uses_period: z.boolean(),
    }),
  ),
});
export type ReportCatalog = z.infer<typeof reportCatalogSchema>;

export const reportParamsSchema = z.object({ type: z.enum(REPORT_TYPES) });

export const reportQuerySchema = z.object({
  format: z.enum(REPORT_FORMATS).optional(),
  /** One line; all lines when left out. */
  line: z.string().min(1).optional(),
  from: calendarDateSchema.optional(),
  to: calendarDateSchema.optional(),
  /** json only. */
  page: z.number().int().positive().optional(),
  page_size: z.number().int().positive().max(PAGE_SIZE_MAX).optional(),
});
export type ReportQuery = z.input<typeof reportQuerySchema>;
export type ReportFilters = Pick<ReportQuery, "line" | "from" | "to">;

export const reportSchema = z.object({
  type: z.enum(REPORT_TYPES),
  title: z.string(),
  columns: z.array(reportColumnSchema),
  rows: z.array(z.record(z.string(), reportCellSchema)),
  /** Rows in the whole report, not only this page. */
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
  /** The filter as applied (the server fills in a default period when none is sent). */
  filters: z.object({
    line: lineSummarySchema.nullable(),
    from: calendarDateSchema.nullable(),
    to: calendarDateSchema.nullable(),
  }),
  /** A few headline numbers, already written out ("1,240 students"). */
  summary: z.array(z.object({ label: z.string(), value: z.string() })),
  generated_at: isoDateTime(),
});
export type Report = z.infer<typeof reportSchema>;
