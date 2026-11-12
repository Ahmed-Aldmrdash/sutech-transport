import { fetchEndpointFile, type DownloadedFile } from "@/lib/api/client";
import { isMockMode } from "@/lib/config";
import { getReportEndpoint } from "./api";
import type { ReportFileFormat, ReportFilters, ReportType } from "./schema";

/** "sutech_payments_7_2026-11-01_2026-11-12.xlsx", as the server names it. */
export function reportFileName(
  type: ReportType,
  lineCode: string | null,
  from: string | null,
  to: string | null,
  format: ReportFileFormat,
): string {
  const period = from && to ? `${from}_${to}` : (to ?? from ?? "");
  return [`sutech_${type}`, lineCode ?? "all", period].filter(Boolean).join("_") + `.${format}`;
}

function save({ blob, fileName }: DownloadedFile): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before the URL goes away.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/**
 * Downloads the report as Excel or PDF with the filter on screen. The server makes the file;
 * in mock mode the browser makes the same file from the mock report (loaded only then).
 */
export async function downloadReport(
  type: ReportType,
  filters: ReportFilters,
  format: ReportFileFormat,
  lineCode: string | null,
): Promise<void> {
  if (isMockMode) {
    const { buildMockReportFile } = await import("./mock-export");
    save(await buildMockReportFile(type, filters, format));
    return;
  }
  const fallback = reportFileName(type, lineCode, filters.from ?? null, filters.to ?? null, format);
  save(
    await fetchEndpointFile(
      getReportEndpoint,
      { params: { type }, query: { ...filters, format } },
      fallback,
    ),
  );
}
