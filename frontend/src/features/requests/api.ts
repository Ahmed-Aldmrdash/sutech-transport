import { z } from "zod";
import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/lib/auth/roles";
import {
  createComplaintBodySchema,
  createLineChangeBodySchema,
  createModelPermitBodySchema,
  createRefundBodySchema,
  listMyRequestsQuerySchema,
  refundPolicySchema,
  requestParamsSchema,
  studentRequestSchema,
  type CreateComplaintBody,
  type CreateLineChangeBody,
  type CreateModelPermitBody,
  type CreateRefundBody,
  type RefundPolicy,
  type RequestKind,
  type StudentRequest,
} from "./schema";

const TAG = "requests";

export const listMyRequestsEndpoint = defineEndpoint({
  id: "requests.listMine",
  method: HttpMethod.Get,
  path: "/requests/me",
  summary:
    "The student's line change, refund, complaint and model permit requests this term, newest first, each " +
    "with its status history. Office notes follow Accept-Language.",
  tag: TAG,
  access: [Role.Student],
  query: listMyRequestsQuerySchema,
  response: z.array(studentRequestSchema),
});

export const getRequestEndpoint = defineEndpoint({
  id: "requests.get",
  method: HttpMethod.Get,
  path: "/requests/{request_id}",
  summary: "One of the student's own requests. Another student's request answers 404.",
  tag: TAG,
  access: [Role.Student],
  params: requestParamsSchema,
  response: studentRequestSchema,
});

export const createLineChangeEndpoint = defineEndpoint({
  id: "requests.createLineChange",
  method: HttpMethod.Post,
  path: "/requests/line-change",
  summary:
    "The university's line change form: new line and stop, permanent or temporary (with " +
    "dates), the reason, and the guardian's approval. Needs an active subscription. Errors: " +
    "NO_ACTIVE_SUBSCRIPTION (409), REQUEST_ALREADY_OPEN (409), SAME_LINE (422), " +
    "INVALID_DATES (422), LINE_NOT_FOUND (404), STOP_NOT_ON_LINE (422).",
  tag: TAG,
  access: [Role.Student],
  idempotent: true,
  body: createLineChangeBodySchema,
  response: studentRequestSchema,
});

export const createRefundEndpoint = defineEndpoint({
  id: "requests.createRefund",
  method: HttpMethod.Post,
  path: "/requests/refund",
  summary:
    "Cancels the paid subscription and asks for a refund under the term's refund policy, with " +
    "the guardian's approval. An ordinary refund is refused once the deduction reaches 100%; " +
    "medical, bereavement and transfer cases are decided by the university and need documents. " +
    "Errors: NO_ACTIVE_SUBSCRIPTION (409), REQUEST_ALREADY_OPEN (409), " +
    "REFUND_WINDOW_CLOSED (422), DOCUMENTS_REQUIRED (422), RECEIPT_TOO_LARGE (413).",
  tag: TAG,
  access: [Role.Student],
  idempotent: true,
  body: createRefundBodySchema,
  response: studentRequestSchema,
});

export const createComplaintEndpoint = defineEndpoint({
  id: "requests.createComplaint",
  method: HttpMethod.Post,
  path: "/requests/complaint",
  summary:
    "A complaint to the Transportation office (driver, delay, bus condition, crowding, safety, " +
    "payment, other), with optional photos. Payment complaints need a booking; the others an " +
    "active subscription. Errors: NO_SUBSCRIPTION (409), NO_ACTIVE_SUBSCRIPTION (409), " +
    "LINE_NOT_FOUND (404), INVALID_DATES (422), RECEIPT_TOO_LARGE (413).",
  tag: TAG,
  access: [Role.Student],
  idempotent: true,
  body: createComplaintBodySchema,
  response: studentRequestSchema,
});

export const createModelPermitEndpoint = defineEndpoint({
  id: "requests.createModelPermit",
  method: HttpMethod.Post,
  path: "/requests/model-permit",
  summary:
    "The university's safety permit to bring a project model onto the bus: material, size, " +
    "purpose and destination, entry and exit date and time, the doctor or TA responsible, and " +
    "the student's liability declaration. The server fills the student's details and the bus " +
    "(their own line) from the account and subscription; the office adds the driver later. " +
    "Signed by the doctor/TA, then the Safety department. Needs an active subscription. " +
    "Errors: NO_ACTIVE_SUBSCRIPTION (409), REQUEST_ALREADY_OPEN (409), INVALID_DATES (422).",
  tag: TAG,
  access: [Role.Student],
  idempotent: true,
  body: createModelPermitBodySchema,
  response: studentRequestSchema,
});

export const withdrawRequestEndpoint = defineEndpoint({
  id: "requests.withdraw",
  method: HttpMethod.Post,
  path: "/requests/{request_id}/withdraw",
  summary:
    "The student takes back a request the office hasn't started on yet. " +
    "Errors: NOT_WITHDRAWABLE (409).",
  tag: TAG,
  access: [Role.Student],
  idempotent: true,
  params: requestParamsSchema,
  response: studentRequestSchema,
});

export const getRefundPolicyEndpoint = defineEndpoint({
  id: "requests.getRefundPolicy",
  method: HttpMethod.Get,
  path: "/requests/refund-policy",
  summary:
    "The term's refund table, today's deduction (Cairo date) and the amount the student paid. " +
    "From the server so the dates change each term without a new app.",
  tag: TAG,
  access: [Role.Student],
  response: refundPolicySchema,
});

export function listMyRequests(
  kind?: RequestKind,
  options?: RequestOptions,
): Promise<StudentRequest[]> {
  return callEndpoint(listMyRequestsEndpoint, { query: { kind } }, options);
}

export function getRequest(requestId: string, options?: RequestOptions): Promise<StudentRequest> {
  return callEndpoint(getRequestEndpoint, { params: { request_id: requestId } }, options);
}

export function createLineChange(
  body: CreateLineChangeBody,
  options?: RequestOptions,
): Promise<StudentRequest> {
  return callEndpoint(createLineChangeEndpoint, { body }, options);
}

export function createRefund(
  body: CreateRefundBody,
  options?: RequestOptions,
): Promise<StudentRequest> {
  return callEndpoint(createRefundEndpoint, { body }, options);
}

export function createComplaint(
  body: CreateComplaintBody,
  options?: RequestOptions,
): Promise<StudentRequest> {
  return callEndpoint(createComplaintEndpoint, { body }, options);
}

export function createModelPermit(
  body: CreateModelPermitBody,
  options?: RequestOptions,
): Promise<StudentRequest> {
  return callEndpoint(createModelPermitEndpoint, { body }, options);
}

export function withdrawRequest(
  requestId: string,
  options?: RequestOptions,
): Promise<StudentRequest> {
  return callEndpoint(withdrawRequestEndpoint, { params: { request_id: requestId } }, options);
}

export function getRefundPolicy(options?: RequestOptions): Promise<RefundPolicy> {
  return callEndpoint(getRefundPolicyEndpoint, {}, options);
}

export const requestsEndpoints = [
  listMyRequestsEndpoint,
  getRefundPolicyEndpoint,
  getRequestEndpoint,
  createLineChangeEndpoint,
  createRefundEndpoint,
  createComplaintEndpoint,
  createModelPermitEndpoint,
  withdrawRequestEndpoint,
];
