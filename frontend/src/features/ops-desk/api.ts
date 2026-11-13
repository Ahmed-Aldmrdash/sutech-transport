import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/lib/auth/roles";
import {
  attendanceQuerySchema,
  liveBusesSchema,
  lineAttendanceSchema,
  opsDayQuerySchema,
  opsFleetSchema,
  opsLineDetailSchema,
  opsLineParamsSchema,
  opsLinesSchema,
  opsOverviewSchema,
  opsStudentDetailSchema,
  opsStudentParamsSchema,
  opsStudentsSchema,
  studentsQuerySchema,
  type AttendanceQuery,
  type LineAttendance,
  type LiveBuses,
  type OpsDayQuery,
  type OpsFleet,
  type OpsLineDetail,
  type OpsLines,
  type OpsOverview,
  type OpsStudentDetail,
  type OpsStudents,
  type StudentsQuery,
} from "./schema";

const TAG = "operations";
const TRANSPORT = [Role.SuperAdmin, Role.Transport];

export const getOpsOverviewEndpoint = defineEndpoint({
  id: "ops.overview",
  method: HttpMethod.Get,
  path: "/admin/overview",
  summary:
    "The Transportation office's home: the same day view as the Secretary General's " +
    "(riding per line, delays, SOS, event buses) plus `queues`, what waits for the office " +
    "now. `date` defaults to today; up to 31 days back. Errors: DATE_INVALID (422).",
  tag: TAG,
  access: TRANSPORT,
  query: opsDayQuerySchema,
  response: opsOverviewSchema,
});

export const getLiveBusesEndpoint = defineEndpoint({
  id: "ops.live",
  method: HttpMethod.Get,
  path: "/admin/live",
  summary:
    "Every line's bus this morning on one map: latest GPS fix, the last stop passed, share " +
    "of the trip done, riders scanned, the crew's delay and any open SOS. After the first " +
    "read, follow `bus.location` on the WebSocket (the app re-reads every 10 s until then).",
  tag: TAG,
  access: TRANSPORT,
  response: liveBusesSchema,
});

export const listOpsLinesEndpoint = defineEndpoint({
  id: "ops.lines",
  method: HttpMethod.Get,
  path: "/admin/lines",
  summary:
    "Every line with its own bus and driver, stops, subscribers, held seats and free seats, " +
    "in the university's order.",
  tag: TAG,
  access: TRANSPORT,
  response: opsLinesSchema,
});

export const getOpsLineEndpoint = defineEndpoint({
  id: "ops.line",
  method: HttpMethod.Get,
  path: "/admin/lines/{line_id}",
  summary:
    "One line: its stops with subscribers at each, its subscribers by stop, and today's " +
    "morning trip id (for changing the bus or driver). Errors: LINE_NOT_FOUND (404).",
  tag: TAG,
  access: TRANSPORT,
  params: opsLineParamsSchema,
  response: opsLineDetailSchema,
});

export const getLineAttendanceEndpoint = defineEndpoint({
  id: "ops.attendance",
  method: HttpMethod.Get,
  path: "/admin/attendance",
  summary:
    "Who rode one line's morning trip on one day: every subscriber with boarded, left on the " +
    "way (with the reason), not going (with the reason) or absent. `date` defaults to today; " +
    "up to 31 days back. Errors: DATE_INVALID (422), LINE_NOT_FOUND (404).",
  tag: TAG,
  access: TRANSPORT,
  query: attendanceQuerySchema,
  response: lineAttendanceSchema,
});

export const listOpsStudentsEndpoint = defineEndpoint({
  id: "ops.students",
  method: HttpMethod.Get,
  path: "/admin/students",
  summary:
    "Students with a subscription this term. `q`: university ID or part of the name; " +
    "`line_id`. 25 a page, by name.",
  tag: TAG,
  access: TRANSPORT,
  query: studentsQuerySchema,
  response: opsStudentsSchema,
});

export const getOpsStudentEndpoint = defineEndpoint({
  id: "ops.student",
  method: HttpMethod.Get,
  path: "/admin/students/{student_id}",
  summary:
    "One student for the office: contact, guardian, seat, this term's morning trips so far " +
    "and their requests. Errors: STUDENT_NOT_FOUND (404).",
  tag: TAG,
  access: TRANSPORT,
  params: opsStudentParamsSchema,
  response: opsStudentDetailSchema,
});

export const getOpsFleetEndpoint = defineEndpoint({
  id: "ops.fleet",
  method: HttpMethod.Get,
  path: "/admin/buses",
  summary:
    "Every bus with its driver and what it does today (the same shape as Abu El Hol's " +
    "fleet), plus today's morning trip per line for changing a line's bus or driver.",
  tag: TAG,
  access: TRANSPORT,
  response: opsFleetSchema,
});

export function getOpsOverview(
  query: OpsDayQuery = {},
  options?: RequestOptions,
): Promise<OpsOverview> {
  return callEndpoint(getOpsOverviewEndpoint, { query }, options);
}

export function getLiveBuses(options?: RequestOptions): Promise<LiveBuses> {
  return callEndpoint(getLiveBusesEndpoint, {}, options);
}

export function listOpsLines(options?: RequestOptions): Promise<OpsLines> {
  return callEndpoint(listOpsLinesEndpoint, {}, options);
}

export function getOpsLine(lineId: string, options?: RequestOptions): Promise<OpsLineDetail> {
  return callEndpoint(getOpsLineEndpoint, { params: { line_id: lineId } }, options);
}

export function getLineAttendance(
  query: AttendanceQuery,
  options?: RequestOptions,
): Promise<LineAttendance> {
  return callEndpoint(getLineAttendanceEndpoint, { query }, options);
}

export function listOpsStudents(
  query: StudentsQuery = {},
  options?: RequestOptions,
): Promise<OpsStudents> {
  return callEndpoint(listOpsStudentsEndpoint, { query }, options);
}

export function getOpsStudent(
  studentId: string,
  options?: RequestOptions,
): Promise<OpsStudentDetail> {
  return callEndpoint(getOpsStudentEndpoint, { params: { student_id: studentId } }, options);
}

export function getOpsFleet(options?: RequestOptions): Promise<OpsFleet> {
  return callEndpoint(getOpsFleetEndpoint, {}, options);
}

export const opsDeskEndpoints = [
  getOpsOverviewEndpoint,
  getLiveBusesEndpoint,
  listOpsLinesEndpoint,
  getOpsLineEndpoint,
  getLineAttendanceEndpoint,
  listOpsStudentsEndpoint,
  getOpsStudentEndpoint,
  getOpsFleetEndpoint,
];
