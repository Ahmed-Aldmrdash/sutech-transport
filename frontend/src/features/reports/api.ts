import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/lib/auth/roles";
import {
  reportCatalogSchema,
  reportParamsSchema,
  reportQuerySchema,
  reportSchema,
  type Report,
  type ReportCatalog,
  type ReportFilters,
  type ReportType,
} from "./schema";

const TAG = "reports";
const READERS = [Role.SuperAdmin, Role.Transport, Role.Finance, Role.SecretaryGeneral];

export const listReportsEndpoint = defineEndpoint({
  id: "reports.list",
  method: HttpMethod.Get,
  path: "/admin/reports",
  summary: "The report types the caller's role may open, with their titles.",
  tag: TAG,
  access: READERS,
  response: reportCatalogSchema,
});

export const getReportEndpoint = defineEndpoint({
  id: "reports.get",
  method: HttpMethod.Get,
  path: "/admin/reports/{type}",
  summary:
    "The report on screen (`format=json`, paged with `page` / `page_size`) or as a download " +
    "(`format=xlsx` or `pdf`: the file itself, with Content-Disposition " +
    '"sutech_<type>_<line or all>_<from>_<to>.<ext>"). Same filter, same rows and numbers in ' +
    "every format. Money is in piasters in json and in pounds in the files; times are Egypt " +
    "time. The PDF is Arabic RTL (or English, per Accept-Language) with the official logo, " +
    "the filter and the time it was made. Without `from`/`to` the server uses this month so " +
    "far (attendance: this week). Every export is written to the audit log. Errors: " +
    "FORBIDDEN (403, a report the role may not see), INVALID_RANGE, REPORT_RANGE_TOO_LONG " +
    "(attendance over 31 days), REPORT_TOO_LARGE_FOR_PDF (over 2,000 rows) (422), " +
    "LINE_NOT_FOUND (404).",
  tag: TAG,
  access: READERS,
  params: reportParamsSchema,
  query: reportQuerySchema,
  response: reportSchema,
});

export function listReports(options?: RequestOptions): Promise<ReportCatalog> {
  return callEndpoint(listReportsEndpoint, {}, options);
}

export function getReport(
  type: ReportType,
  query: ReportFilters & { page?: number; page_size?: number },
  options?: RequestOptions,
): Promise<Report> {
  return callEndpoint(
    getReportEndpoint,
    { params: { type }, query: { ...query, format: "json" } },
    options,
  );
}

export const reportsEndpoints = [listReportsEndpoint, getReportEndpoint];
