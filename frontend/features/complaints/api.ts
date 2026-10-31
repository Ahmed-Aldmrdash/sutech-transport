import { call } from "@/lib/api/client";
import { defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/features/auth/roles";
import { Complaint, ComplaintList, NewComplaint, Reply } from "./schema";
import type { ComplaintCategory } from "./schema";

const HANDLERS = [Role.SuperAdmin, Role.TransportAdmin] as const;

export const endpoints = {
  mine: defineEndpoint({
    tag: "complaints",
    method: "GET",
    path: "/complaints",
    summary: "The student's complaints and replies.",
    roles: [Role.Student],
    response: ComplaintList,
  }),
  create: defineEndpoint({
    tag: "complaints",
    method: "POST",
    path: "/complaints",
    summary: "File a complaint. Payment complaints are allowed after booking, the rest after activation.",
    roles: [Role.Student],
    body: NewComplaint,
    response: Complaint,
    idempotent: true,
  }),
  adminList: defineEndpoint({
    tag: "complaints",
    method: "GET",
    path: "/admin/complaints",
    summary: "All complaints, newest first.",
    roles: [...HANDLERS, Role.SecretaryGeneral],
    response: ComplaintList,
  }),
  reply: defineEndpoint({
    tag: "complaints",
    method: "POST",
    path: "/admin/complaints/{complaint_id}/reply",
    summary: "Reply once; the student is notified.",
    roles: HANDLERS,
    body: Reply,
    response: Complaint,
  }),
};

export const listMyComplaints = () => call(endpoints.mine);
export const fileComplaint = (category: ComplaintCategory, text: string) =>
  call(endpoints.create, { body: { category, text } });
export const listAllComplaints = () => call(endpoints.adminList);
export const replyToComplaint = (id: string, reply: string) =>
  call(endpoints.reply, { params: { complaint_id: id }, body: { reply } });
