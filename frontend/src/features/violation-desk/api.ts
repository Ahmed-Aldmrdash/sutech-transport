import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/lib/auth/roles";
import {
  deskViolationListQuerySchema,
  deskViolationListSchema,
  deskViolationSchema,
  violationDeskActionBodySchema,
  violationParamsSchema,
  type DeskViolation,
  type DeskViolationList,
  type DeskViolationListQuery,
  type ViolationDeskActionBody,
} from "./schema";

const TAG = "violation-desk";
const READERS = [Role.SuperAdmin, Role.StudentAffairs, Role.Transport];

export const listDeskViolationsEndpoint = defineEndpoint({
  id: "violationDesk.list",
  method: HttpMethod.Get,
  path: "/admin/violations",
  summary:
    "Every violation the crews recorded, with the student, the reporter, the line and the " +
    "decision. Filter by `status` and `rule`, search `q` (university ID or name). `counts` " +
    "holds the totals per status for the tabs.",
  tag: TAG,
  access: READERS,
  query: deskViolationListQuerySchema,
  response: deskViolationListSchema,
});

export const getDeskViolationEndpoint = defineEndpoint({
  id: "violationDesk.get",
  method: HttpMethod.Get,
  path: "/admin/violations/{violation_id}",
  summary:
    "One violation with a short-lived `photo_url` and what the caller may do now. " +
    "Errors: NOT_FOUND (404).",
  tag: TAG,
  access: READERS,
  params: violationParamsSchema,
  response: deskViolationSchema,
});

export const actOnViolationEndpoint = defineEndpoint({
  id: "violationDesk.act",
  method: HttpMethod.Patch,
  path: "/admin/violations/{violation_id}",
  summary:
    "Student Affairs only: `open` it, or `close` it with an `outcome` (warning, " +
    "investigation, dismissed) and a `note` for the file. The crew sees the status change; " +
    "logged in the audit log. Errors: VIOLATION_CLOSED (409), DECISION_REQUIRED (422), " +
    "FORBIDDEN (403 for the Transportation office).",
  tag: TAG,
  access: [Role.SuperAdmin, Role.StudentAffairs],
  idempotent: true,
  params: violationParamsSchema,
  body: violationDeskActionBodySchema,
  response: deskViolationSchema,
});

export function listDeskViolations(
  query: DeskViolationListQuery = {},
  options?: RequestOptions,
): Promise<DeskViolationList> {
  return callEndpoint(listDeskViolationsEndpoint, { query }, options);
}

export function getDeskViolation(
  violationId: string,
  options?: RequestOptions,
): Promise<DeskViolation> {
  return callEndpoint(getDeskViolationEndpoint, { params: { violation_id: violationId } }, options);
}

export function actOnViolation(
  violationId: string,
  body: ViolationDeskActionBody,
  options?: RequestOptions,
): Promise<DeskViolation> {
  return callEndpoint(
    actOnViolationEndpoint,
    { params: { violation_id: violationId }, body },
    options,
  );
}

export const violationDeskEndpoints = [
  listDeskViolationsEndpoint,
  getDeskViolationEndpoint,
  actOnViolationEndpoint,
];
