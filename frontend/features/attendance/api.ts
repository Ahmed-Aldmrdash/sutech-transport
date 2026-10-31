import { call } from "@/lib/api/client";
import { Ok } from "@/lib/api/common";
import { defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/features/auth/roles";
import { AttendanceSummary, DayRecord, SkipDay } from "./schema";

export const endpoints = {
  mine: defineEndpoint({
    tag: "attendance",
    method: "GET",
    path: "/attendance/me",
    summary: "The student's day: not-going report, boarding, arrival, check-out or absence.",
    roles: [Role.Student],
    response: DayRecord,
  }),
  skip: defineEndpoint({
    tag: "attendance",
    method: "POST",
    path: "/absences",
    summary: "\"Not going today\": tells the driver, the transport office and the parent. No absence is recorded.",
    roles: [Role.Student],
    body: SkipDay,
    response: Ok,
    idempotent: true,
  }),
  unskip: defineEndpoint({
    tag: "attendance",
    method: "DELETE",
    path: "/absences/{date}",
    summary: "Take back a not-going report (before the student boards).",
    roles: [Role.Student],
    response: Ok,
  }),
  admin: defineEndpoint({
    tag: "attendance",
    method: "GET",
    path: "/admin/attendance",
    summary: "Attendance for a date, optionally one line (query: date, line).",
    roles: [Role.SuperAdmin, Role.TransportAdmin],
    response: AttendanceSummary,
  }),
};

export const getMyDay = () => call(endpoints.mine);
export const skipToday = (date: string) => call(endpoints.skip, { body: { date } });
export const unskipToday = (date: string) => call(endpoints.unskip, { params: { date } });
export const getAttendance = (date: string, lineId?: string) =>
  call(endpoints.admin, { query: { date, line: lineId } });
