import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/lib/auth/roles";
import {
  absenceParamsSchema,
  absenceSchema,
  createAbsenceBodySchema,
  myAbsencesSchema,
  type Absence,
  type CreateAbsenceBody,
  type MyAbsences,
} from "./schema";

const TAG = "absences";

export const listMyAbsencesEndpoint = defineEndpoint({
  id: "absences.listMine",
  method: HttpMethod.Get,
  path: "/absences/me",
  summary:
    'The active subscriber\'s reported "not going" days from today on, and the next service ' +
    "days they can still report (7 days ahead, today until the bus leaves the line's first " +
    "stop). Errors: NO_ACTIVE_SUBSCRIPTION (409).",
  tag: TAG,
  access: [Role.Student],
  response: myAbsencesSchema,
});

export const createAbsenceEndpoint = defineEndpoint({
  id: "absences.create",
  method: HttpMethod.Post,
  path: "/absences",
  summary:
    '"Not going" for one service day (both trips). The driver, the supervisor, the guardian ' +
    "and the Transportation office are told, and the student is not marked absent that day. " +
    "Errors: NO_ACTIVE_SUBSCRIPTION (409), DATE_NOT_REPORTABLE (422), " +
    "ABSENCE_CUTOFF_PASSED (409), ALREADY_REPORTED (409).",
  tag: TAG,
  access: [Role.Student],
  idempotent: true,
  body: createAbsenceBodySchema,
  response: absenceSchema,
});

export const cancelAbsenceEndpoint = defineEndpoint({
  id: "absences.cancel",
  method: HttpMethod.Post,
  path: "/absences/{absence_id}/cancel",
  summary:
    'Takes back a "not going" report before the bus leaves the line\'s first stop; the same ' +
    "people are told the student is riding after all. Errors: ABSENCE_CUTOFF_PASSED (409).",
  tag: TAG,
  access: [Role.Student],
  idempotent: true,
  params: absenceParamsSchema,
  response: myAbsencesSchema,
});

export function listMyAbsences(options?: RequestOptions): Promise<MyAbsences> {
  return callEndpoint(listMyAbsencesEndpoint, {}, options);
}

export function createAbsence(body: CreateAbsenceBody, options?: RequestOptions): Promise<Absence> {
  return callEndpoint(createAbsenceEndpoint, { body }, options);
}

export function cancelAbsence(absenceId: string, options?: RequestOptions): Promise<MyAbsences> {
  return callEndpoint(cancelAbsenceEndpoint, { params: { absence_id: absenceId } }, options);
}

export const absencesEndpoints = [
  listMyAbsencesEndpoint,
  createAbsenceEndpoint,
  cancelAbsenceEndpoint,
];
