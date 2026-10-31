import { z } from "zod";

export const ReportType = { Roster: "roster", Payments: "payments", Attendance: "attendance", Occupancy: "occupancy" } as const;
export type ReportType = (typeof ReportType)[keyof typeof ReportType];

export const ReportFile = z.object({
  file_name: z.string(),
  mime_type: z.string(),
  /** Base64 file content. The real server streams the file; the mock returns it inline. */
  content_base64: z.string(),
  rows: z.number().int().nonnegative(),
});
export type ReportFile = z.infer<typeof ReportFile>;
