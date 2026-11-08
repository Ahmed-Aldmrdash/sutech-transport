import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/lib/auth/roles";
import {
  createViolationBodySchema,
  myViolationsSchema,
  violationSchema,
  type CreateViolationBody,
  type MyViolations,
  type Violation,
} from "./schema";

const TAG = "violations";

export const createViolationEndpoint = defineEndpoint({
  id: "violations.create",
  method: HttpMethod.Post,
  path: "/violations",
  summary:
    "The crew records a breach of the bus Code of Conduct with a photo. It goes to Student " +
    "Affairs and the Transportation office (admin violations page). Errors: " +
    "STUDENT_NOT_FOUND (404), FILE_TYPE (422), FILE_TOO_LARGE (413).",
  tag: TAG,
  access: [Role.Driver, Role.Supervisor],
  idempotent: true,
  body: createViolationBodySchema,
  response: violationSchema,
});

export const listMyViolationsEndpoint = defineEndpoint({
  id: "violations.listMine",
  method: HttpMethod.Get,
  path: "/violations/mine",
  summary: "The violations this crew member recorded, newest first, with their status.",
  tag: TAG,
  access: [Role.Driver, Role.Supervisor],
  response: myViolationsSchema,
});

export function createViolation(
  body: CreateViolationBody,
  options?: RequestOptions,
): Promise<Violation> {
  return callEndpoint(createViolationEndpoint, { body }, options);
}

export function listMyViolations(options?: RequestOptions): Promise<MyViolations> {
  return callEndpoint(listMyViolationsEndpoint, {}, options);
}

export const violationsEndpoints = [createViolationEndpoint, listMyViolationsEndpoint];
