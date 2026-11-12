import { ApiError } from "@/lib/api/errors";
import type { DownloadedFile } from "@/lib/api/client";
import { APP_TIME_ZONE, PIASTERS_PER_POUND } from "@/lib/format";
import { getReport } from "./api";
import { reportFileName } from "./download";
import {
  ColumnKind,
  PDF_MAX_ROWS,
  ReportErrorCode,
  ReportFormat,
  type Report,
  type ReportColumn,
  type ReportFileFormat,
  type ReportFilters,
  type ReportRow,
  type ReportType,
} from "./schema";

/**
 * Mock mode only: makes the Excel or PDF file in the browser, as the server will, from the same
 * rows the screen shows. Loaded on demand so the libraries never reach a live build's pages.
 */

const PAGE_SIZE = 200;
const HTTP_UNPROCESSABLE = 422;
const BRAND = {
  purple: "#58286E",
  teal: "#257988",
  tint: "#EEE9F1",
  line: "#D9D2DE",
  ink: "#1F1A24",
};

type Language = "ar" | "en";

const TEXT: Record<
  Language,
  Record<"line" | "allLines" | "period" | "until" | "made" | "page", string>
> = {
  ar: {
    line: "الخط",
    allLines: "كل الخطوط",
    period: "الفترة",
    until: "لحد",
    made: "اتعمل",
    page: "صفحة",
  },
  en: {
    line: "Line",
    allLines: "All lines",
    period: "Period",
    until: "to",
    made: "Made",
    page: "Page",
  },
};

/** Latin digits in Arabic too, as on the screen: IDs and amounts must match the receipts. */
const NUMBER_LOCALE: Record<Language, string> = { ar: "ar-EG-u-nu-latn", en: "en-US" };

function languageOf(): Language {
  return document.documentElement.lang === "en" ? "en" : "ar";
}

async function wholeReport(type: ReportType, filters: ReportFilters): Promise<Report> {
  const first = await getReport(type, { ...filters, page: 1, page_size: PAGE_SIZE });
  const rows = [...first.rows];
  for (let page = 2; rows.length < first.total; page += 1) {
    const next = await getReport(type, { ...filters, page, page_size: PAGE_SIZE });
    if (next.rows.length === 0) break;
    rows.push(...next.rows);
  }
  return { ...first, rows };
}

function madeAt(report: Report, language: Language): string {
  return new Intl.DateTimeFormat(NUMBER_LOCALE[language], {
    timeZone: APP_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(report.generated_at));
}

function filterLines(report: Report, language: Language): string[] {
  const text = TEXT[language];
  const { line, from, to } = report.filters;
  const lines = [`${text.line}: ${line ? `${line.code} · ${line.name}` : text.allLines}`];
  if (from && to) lines.push(`${text.period}: ${from} ${text.until} ${to}`);
  lines.push(`${text.made}: ${madeAt(report, language)}`);
  return lines;
}

/** The cell as written in the files: money in pounds, percent as a share. */
function fileValue(column: ReportColumn, row: ReportRow): string | number | null {
  const value = row[column.key] ?? null;
  if (typeof value !== "number") return value;
  if (column.kind === ColumnKind.Money) return value / PIASTERS_PER_POUND;
  if (column.kind === ColumnKind.Percent) return value / 100;
  return value;
}

// ---------------------------------------------------------------------------------------------
// Excel

const EXCEL_FORMAT: Partial<Record<ReportColumn["kind"], string>> = {
  [ColumnKind.Money]: "#,##0.00",
  [ColumnKind.Number]: "#,##0",
  [ColumnKind.Percent]: "0%",
};
const EXCEL_MIN_WIDTH = 10;
const EXCEL_MAX_WIDTH = 42;

async function toExcel(report: Report, language: Language): Promise<Blob> {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const width = report.columns.length;
  const banner = (value: string, bold = false) => [
    { value, fontWeight: bold ? ("bold" as const) : undefined, columnSpan: width },
    ...Array.from({ length: width - 1 }, () => null),
  ];
  const header = report.columns.map((column) => ({
    value: column.label,
    fontWeight: "bold" as const,
    textColor: "#FFFFFF",
    backgroundColor: BRAND.purple,
    align: language === "ar" ? ("right" as const) : ("left" as const),
  }));
  const body = report.rows.map((row) =>
    report.columns.map((column) => {
      const value = fileValue(column, row);
      if (value === null) return null;
      return typeof value === "number"
        ? { value, type: Number, format: EXCEL_FORMAT[column.kind] }
        : { value, type: String };
    }),
  );
  const top = [
    banner(report.title, true),
    ...filterLines(report, language).map((line) => banner(line)),
    ...report.summary.map((item) => banner(`${item.label}: ${item.value}`)),
    [],
  ];
  const widths = report.columns.map((column) => {
    const longest = Math.max(
      column.label.length,
      ...report.rows.slice(0, 200).map((row) => String(row[column.key] ?? "").length),
    );
    return { width: Math.min(EXCEL_MAX_WIDTH, Math.max(EXCEL_MIN_WIDTH, longest + 2)) };
  });
  return writeXlsxFile([...top, header, ...body], {
    sheet: report.title.slice(0, 31),
    columns: widths,
    rightToLeft: language === "ar",
    stickyRowsCount: top.length + 1,
  }).toBlob();
}

// ---------------------------------------------------------------------------------------------
// PDF: each page is drawn on a canvas, which shapes Arabic correctly, then put in the PDF.

const PAGE = { width: 1754, height: 1240, margin: 64 };
const ROW_HEIGHT = 34;
const HEADER_HEIGHT = 40;
const FOOTER_HEIGHT = 48;
const CELL_PADDING = 10;
const JPEG_QUALITY = 0.92;
const LOGO_HEIGHT = 72;

function cellText(column: ReportColumn, row: ReportRow, language: Language): string {
  const value = row[column.key];
  if (value === null || value === undefined) return "";
  if (typeof value !== "number") return value;
  const locale = NUMBER_LOCALE[language];
  if (column.kind === ColumnKind.Money) {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: 2 }).format(
      value / PIASTERS_PER_POUND,
    );
  }
  if (column.kind === ColumnKind.Percent) return `${new Intl.NumberFormat(locale).format(value)}%`;
  return new Intl.NumberFormat(locale).format(value);
}

function fit(context: CanvasRenderingContext2D, text: string, width: number): string {
  if (context.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && context.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut}…`;
}

function loadLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = "/brand/sutech-logo.svg";
  });
}

interface Layout {
  font: string;
  rtl: boolean;
  /** Left edge and width of each column, already in reading order. */
  cells: { x: number; width: number }[];
}

function layoutOf(context: CanvasRenderingContext2D, report: Report, language: Language): Layout {
  const font = getComputedStyle(document.body).fontFamily || "sans-serif";
  context.font = `16px ${font}`;
  const widths = report.columns.map((column) => {
    const sample = report.rows
      .slice(0, 300)
      .map((row) => context.measureText(cellText(column, row, language)).width);
    return Math.max(context.measureText(column.label).width, ...sample) + CELL_PADDING * 2;
  });
  const usable = PAGE.width - PAGE.margin * 2;
  const total = widths.reduce((sum, width) => sum + width, 0);
  const scaled = widths.map((width) => (width / total) * usable);
  const rtl = language === "ar";
  const cells: Layout["cells"] = [];
  let edge = rtl ? PAGE.width - PAGE.margin : PAGE.margin;
  for (const width of scaled) {
    cells.push({ x: rtl ? edge - width : edge, width });
    edge += rtl ? -width : width;
  }
  return { font, rtl, cells };
}

function drawRow(
  context: CanvasRenderingContext2D,
  layout: Layout,
  texts: string[],
  y: number,
  height: number,
) {
  texts.forEach((text, index) => {
    const cell = layout.cells[index];
    if (!cell) return;
    const inner = cell.width - CELL_PADDING * 2;
    const x = layout.rtl ? cell.x + cell.width - CELL_PADDING : cell.x + CELL_PADDING;
    context.fillText(fit(context, text, inner), x, y + height / 2);
  });
}

function drawPage(
  canvas: HTMLCanvasElement,
  report: Report,
  language: Language,
  layout: Layout,
  rows: ReportRow[],
  options: { first: boolean; logo: HTMLImageElement | null; pageNumber: number; pages: number },
): number {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available.");
  const { rtl, font } = layout;
  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, PAGE.width, PAGE.height);
  context.direction = rtl ? "rtl" : "ltr";
  context.textAlign = "start";
  context.textBaseline = "middle";
  const start = rtl ? PAGE.width - PAGE.margin : PAGE.margin;
  let y = PAGE.margin;

  if (options.first) {
    if (options.logo) {
      const width = (options.logo.width / options.logo.height) * LOGO_HEIGHT;
      context.drawImage(
        options.logo,
        rtl ? PAGE.margin : PAGE.width - PAGE.margin - width,
        y,
        width,
        LOGO_HEIGHT,
      );
    }
    context.fillStyle = BRAND.purple;
    context.font = `bold 34px ${font}`;
    context.fillText(report.title, start, y + 20);
    context.fillStyle = BRAND.ink;
    context.font = `18px ${font}`;
    filterLines(report, language).forEach((line, index) => {
      context.fillText(line, start, y + 62 + index * 28);
    });
    y += 62 + filterLines(report, language).length * 28 + 8;
    context.font = `bold 18px ${font}`;
    context.fillStyle = BRAND.teal;
    context.fillText(
      report.summary.map((item) => `${item.label}: ${item.value}`).join("   •   "),
      start,
      y + 10,
    );
    y += 40;
  }

  context.fillStyle = BRAND.purple;
  context.fillRect(PAGE.margin, y, PAGE.width - PAGE.margin * 2, HEADER_HEIGHT);
  context.fillStyle = "#FFFFFF";
  context.font = `bold 16px ${font}`;
  drawRow(
    context,
    layout,
    report.columns.map((column) => column.label),
    y,
    HEADER_HEIGHT,
  );
  y += HEADER_HEIGHT;

  context.font = `16px ${font}`;
  rows.forEach((row, index) => {
    if (index % 2 === 1) {
      context.fillStyle = BRAND.tint;
      context.fillRect(PAGE.margin, y, PAGE.width - PAGE.margin * 2, ROW_HEIGHT);
    }
    context.fillStyle = BRAND.ink;
    drawRow(
      context,
      layout,
      report.columns.map((column) => cellText(column, row, language)),
      y,
      ROW_HEIGHT,
    );
    y += ROW_HEIGHT;
  });
  context.strokeStyle = BRAND.line;
  context.beginPath();
  context.moveTo(PAGE.margin, y);
  context.lineTo(PAGE.width - PAGE.margin, y);
  context.stroke();

  context.fillStyle = BRAND.ink;
  context.font = `14px ${font}`;
  context.textAlign = "center";
  context.fillText(
    `${TEXT[language].page} ${options.pageNumber} / ${options.pages} · SUtech`,
    PAGE.width / 2,
    PAGE.height - FOOTER_HEIGHT / 2,
  );
  return y;
}

function rowsPerPage(first: boolean, report: Report, language: Language): number {
  const top = first ? 62 + filterLines(report, language).length * 28 + 8 + 40 : 0;
  const free = PAGE.height - PAGE.margin - FOOTER_HEIGHT - HEADER_HEIGHT - PAGE.margin / 2 - top;
  return Math.max(1, Math.floor(free / ROW_HEIGHT));
}

async function toPdf(report: Report, language: Language): Promise<Blob> {
  if (report.rows.length > PDF_MAX_ROWS) {
    throw new ApiError(
      HTTP_UNPROCESSABLE,
      ReportErrorCode.TooLargeForPdf,
      "Too many rows for a PDF. Pick one line or a shorter period, or use Excel.",
    );
  }
  const [{ jsPDF }, logo] = await Promise.all([import("jspdf"), loadLogo()]);
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = PAGE.width;
  canvas.height = PAGE.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available.");
  const layout = layoutOf(context, report, language);

  const chunks: ReportRow[][] = [];
  let rest = report.rows;
  do {
    const size = rowsPerPage(chunks.length === 0, report, language);
    chunks.push(rest.slice(0, size));
    rest = rest.slice(size);
  } while (rest.length > 0);

  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  chunks.forEach((rows, index) => {
    drawPage(canvas, report, language, layout, rows, {
      first: index === 0,
      logo,
      pageNumber: index + 1,
      pages: chunks.length,
    });
    if (index > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/jpeg", JPEG_QUALITY), "JPEG", 0, 0, pageWidth, pageHeight);
  });
  pdf.setProperties({ title: report.title, creator: "SUtech Transport" });
  return pdf.output("blob");
}

export async function buildMockReportFile(
  type: ReportType,
  filters: ReportFilters,
  format: ReportFileFormat,
): Promise<DownloadedFile> {
  const language = languageOf();
  const report = await wholeReport(type, filters);
  const blob =
    format === ReportFormat.Pdf ? await toPdf(report, language) : await toExcel(report, language);
  const fileName = reportFileName(
    type,
    report.filters.line?.code ?? null,
    report.filters.from,
    report.filters.to ?? report.generated_at.slice(0, 10),
    format,
  );
  return { blob, fileName };
}
