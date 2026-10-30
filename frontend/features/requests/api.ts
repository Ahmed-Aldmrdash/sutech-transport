import { call } from "@/lib/api/client";
import { defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/features/auth/roles";
import { Decision, NewRequest, RequestList, StudentRequest } from "./schema";
import type { NewRequest as NewRequestInput } from "./schema";

const REVIEWERS = [Role.SuperAdmin, Role.TransportAdmin, Role.Finance] as const;

export const endpoints = {
  mine: defineEndpoint({
    tag: "requests",
    method: "GET",
    path: "/requests",
    summary: "The student's requests and where each one is.",
    roles: [Role.Student],
    response: RequestList,
  }),
  create: defineEndpoint({
    tag: "requests",
    method: "POST",
    path: "/requests",
    summary: "Open a request. One open request at a time; active subscribers only.",
    roles: [Role.Student],
    body: NewRequest,
    response: StudentRequest,
    idempotent: true,
  }),
  parentDecision: defineEndpoint({
    tag: "requests",
    method: "POST",
    path: "/requests/{request_id}/parent-decision",
    summary: "The parent approves or rejects (first step of refunds and line changes).",
    roles: [Role.Parent],
    body: Decision,
    response: StudentRequest,
  }),
  adminList: defineEndpoint({
    tag: "requests",
    method: "GET",
    path: "/admin/requests",
    summary: "Requests waiting on the caller's office, plus the history.",
    roles: REVIEWERS,
    response: RequestList,
  }),
  adminDecision: defineEndpoint({
    tag: "requests",
    method: "PATCH",
    path: "/admin/requests/{request_id}",
    summary: "Approve or reject the current step. The last approval carries the request out.",
    roles: REVIEWERS,
    body: Decision,
    response: StudentRequest,
  }),
};

export const listMyRequests = () => call(endpoints.mine);
export const createRequest = (body: NewRequestInput) => call(endpoints.create, { body });
export const parentDecide = (id: string, approve: boolean, reason: string | null = null) =>
  call(endpoints.parentDecision, { params: { request_id: id }, body: { approve, reason } });
export const listAdminRequests = () => call(endpoints.adminList);
export const adminDecide = (id: string, approve: boolean, reason: string | null = null) =>
  call(endpoints.adminDecision, { params: { request_id: id }, body: { approve, reason } });
