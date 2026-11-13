import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/lib/auth/roles";
import {
  returnTimeChangeSchema,
  timetableSchema,
  type ReturnTimeChange,
  type Timetable,
} from "./schema";

const TAG = "operations";
const TRANSPORT = [Role.SuperAdmin, Role.Transport];

export const getTimetableEndpoint = defineEndpoint({
  id: "admin.timetable.get",
  method: HttpMethod.Get,
  path: "/admin/timetable",
  summary:
    "Transportation: every line's day: first pickup, campus arrival and the time the bus " +
    "leaves campus in the afternoon (`return_departure_time`), with who last changed it.",
  tag: TAG,
  access: TRANSPORT,
  response: timetableSchema,
});

export const changeReturnTimeEndpoint = defineEndpoint({
  id: "admin.timetable.return",
  method: HttpMethod.Put,
  path: "/admin/timetable/return-time",
  summary:
    "Transportation: set when the buses leave campus, for the lines in `line_ids` or for " +
    "every line when it is empty. Students, guardians and the crews see the new time at once " +
    "(line page, next trip, the crew's return trip). Logged in the audit log. Errors: " +
    "LINE_NOT_FOUND (404).",
  tag: TAG,
  access: TRANSPORT,
  idempotent: true,
  body: returnTimeChangeSchema,
  response: timetableSchema,
});

export const timetableEndpoints = [getTimetableEndpoint, changeReturnTimeEndpoint];

export function getTimetable(options?: RequestOptions): Promise<Timetable> {
  return callEndpoint(getTimetableEndpoint, {}, options);
}

export function changeReturnTime(
  body: ReturnTimeChange,
  options?: RequestOptions,
): Promise<Timetable> {
  return callEndpoint(changeReturnTimeEndpoint, { body }, options);
}
