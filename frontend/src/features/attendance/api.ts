import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/lib/auth/roles";
import {
  attendanceQuerySchema,
  myAttendanceSchema,
  type MyAttendance,
  type TripOutcome,
} from "./schema";

export const getMyAttendanceEndpoint = defineEndpoint({
  id: "attendance.getMine",
  method: HttpMethod.Get,
  path: "/attendance/me",
  summary:
    "The student's trips this term, newest first: boarding and arrival scans, absences, \"not " +
    'going" days and check-outs with their reason, plus a count of each. Optional `outcome` ' +
    "filter. Text follows Accept-Language. Empty for a student who never rode.",
  tag: "attendance",
  access: [Role.Student],
  query: attendanceQuerySchema,
  response: myAttendanceSchema,
});

export function getMyAttendance(
  query: { outcome?: TripOutcome; page?: number; page_size?: number } = {},
  options?: RequestOptions,
): Promise<MyAttendance> {
  return callEndpoint(getMyAttendanceEndpoint, { query }, options);
}

export const attendanceEndpoints = [getMyAttendanceEndpoint];
