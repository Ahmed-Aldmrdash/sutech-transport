import { z } from "zod";
import { call } from "@/lib/api/client";
import { defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/features/auth/roles";
import { AdminStudent, CancelSubscription, StudentList, Transfer } from "./schema";

const OPERATIONS = [Role.SuperAdmin, Role.TransportAdmin] as const;

export const endpoints = {
  list: defineEndpoint({
    tag: "students",
    method: "GET",
    path: "/admin/students",
    summary: "Students with their subscription (query: line, q).",
    roles: OPERATIONS,
    response: StudentList,
  }),
  transfer: defineEndpoint({
    tag: "students",
    method: "POST",
    path: "/admin/students/{student_id}/transfer",
    summary: "Move a student to another line for today, until a date, or permanently. Student and parent are notified.",
    roles: OPERATIONS,
    body: Transfer,
    response: AdminStudent,
  }),
  cancel: defineEndpoint({
    tag: "students",
    method: "POST",
    path: "/admin/students/{student_id}/cancel",
    summary: "Cancel a subscription for a violation (clause 10). The card stops working at once.",
    roles: OPERATIONS,
    body: CancelSubscription,
    response: AdminStudent,
  }),
};

export const listStudents = (lineId?: string, q?: string) => call(endpoints.list, { query: { line: lineId, q } });
export const transferStudent = (id: string, body: z.infer<typeof Transfer>) =>
  call(endpoints.transfer, { params: { student_id: id }, body });
export const cancelStudentSubscription = (id: string, reason: string) =>
  call(endpoints.cancel, { params: { student_id: id }, body: { reason } });
