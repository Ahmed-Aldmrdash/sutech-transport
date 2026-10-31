import { call } from "@/lib/api/client";
import { defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/features/auth/roles";
import { ReportFile, type ReportType } from "./schema";

export const endpoints = {
  export: defineEndpoint({
    tag: "reports",
    method: "GET",
    path: "/admin/reports/{report_type}",
    summary: "Export a report (query: line, date, format=xlsx|pdf|csv).",
    roles: [Role.SuperAdmin, Role.TransportAdmin, Role.Finance, Role.SecretaryGeneral],
    response: ReportFile,
  }),
};

export const exportReport = (type: ReportType, options: { line?: string; date?: string; format: "csv" | "xlsx" | "pdf" }) =>
  call(endpoints.export, { params: { report_type: type }, query: options });

export function downloadReport(file: ReportFile): void {
  const bytes = Uint8Array.from(atob(file.content_base64), (char) => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: file.mime_type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.file_name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
