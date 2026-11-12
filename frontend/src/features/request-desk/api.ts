import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/lib/auth/roles";
import {
  deskActionBodySchema,
  deskRequestListQuerySchema,
  deskRequestListSchema,
  deskRequestParamsSchema,
  deskRequestSchema,
  type DeskActionBody,
  type DeskRequest,
  type DeskRequestList,
  type DeskRequestListQuery,
} from "./schema";

const TAG = "request-desk";
/** Each office gets only its own requests; the server filters (see the summaries). */
const DESKS = [Role.SuperAdmin, Role.Transport, Role.Finance];

export const listDeskRequestsEndpoint = defineEndpoint({
  id: "requestDesk.list",
  method: HttpMethod.Get,
  path: "/admin/requests",
  summary:
    "The caller's office queue. Transportation: line changes (after the guardian approved), " +
    "model permits and complaints except payment ones. Finance: refunds and payment " +
    "complaints. Super admin: everything. Filter by `kind` (repeatable), `stage` " +
    "(new / in_review / closed) and search `q` (university ID, name or request number). " +
    "`counts` holds the totals per stage for the tabs.",
  tag: TAG,
  access: DESKS,
  query: deskRequestListQuerySchema,
  response: deskRequestListSchema,
});

export const getDeskRequestEndpoint = defineEndpoint({
  id: "requestDesk.get",
  method: HttpMethod.Get,
  path: "/admin/requests/{request_id}",
  summary:
    "One request with the student, what the caller may do now (`allowed_actions`), ready " +
    "answers to start from and, for a line change, the free seats on the new line. " +
    "Errors: NOT_FOUND (404, also for another office's request).",
  tag: TAG,
  access: DESKS,
  params: deskRequestParamsSchema,
  response: deskRequestSchema,
});

export const actOnDeskRequestEndpoint = defineEndpoint({
  id: "requestDesk.act",
  method: HttpMethod.Patch,
  path: "/admin/requests/{request_id}",
  summary:
    "open (take it; optional note), approve / reject (line change, refund, model permit) or " +
    "resolve (complaint). Reject and resolve need a `note`; approving an exceptional refund " +
    "needs `refund_piasters`. Approving moves the student's line from the change's start date, " +
    "or cancels the subscription for a refund. The student gets a notification; logged in the " +
    "audit log. Errors: REQUEST_CLOSED, SEAT_UNAVAILABLE (409), NOTE_REQUIRED, " +
    "ACTION_NOT_ALLOWED, REFUND_AMOUNT_INVALID (422), NOT_FOUND (404).",
  tag: TAG,
  access: DESKS,
  idempotent: true,
  params: deskRequestParamsSchema,
  body: deskActionBodySchema,
  response: deskRequestSchema,
});

export function listDeskRequests(
  query: DeskRequestListQuery = {},
  options?: RequestOptions,
): Promise<DeskRequestList> {
  return callEndpoint(listDeskRequestsEndpoint, { query }, options);
}

export function getDeskRequest(requestId: string, options?: RequestOptions): Promise<DeskRequest> {
  return callEndpoint(getDeskRequestEndpoint, { params: { request_id: requestId } }, options);
}

export function actOnDeskRequest(
  requestId: string,
  body: DeskActionBody,
  options?: RequestOptions,
): Promise<DeskRequest> {
  return callEndpoint(
    actOnDeskRequestEndpoint,
    { params: { request_id: requestId }, body },
    options,
  );
}

export const requestDeskEndpoints = [
  listDeskRequestsEndpoint,
  getDeskRequestEndpoint,
  actOnDeskRequestEndpoint,
];
