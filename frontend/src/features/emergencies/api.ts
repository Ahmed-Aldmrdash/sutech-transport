import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/lib/auth/roles";
import type { SosStatus } from "@/features/sos/schema";
import {
  adminSosListQuerySchema,
  adminSosListSchema,
  adminSosParamsSchema,
  adminSosSchema,
  replacementBodySchema,
  replacementOptionsSchema,
  sosActionBodySchema,
  tripParamsSchema,
  tripReplacementSchema,
  type AdminSos,
  type AdminSosList,
  type ReplacementBody,
  type ReplacementOptions,
  type SosActionBody,
  type TripReplacement,
} from "./schema";

const TAG = "emergencies";
/** The clinic sees medical alerts and accidents only; the server filters the rest out. */
const SOS_DESK = [Role.SuperAdmin, Role.Transport, Role.Clinic];
const TRANSPORT = [Role.SuperAdmin, Role.Transport];

export const listAdminSosEndpoint = defineEndpoint({
  id: "emergencies.list",
  method: HttpMethod.Get,
  path: "/admin/sos",
  summary:
    "Every SOS, newest first, with an optional `status` filter. The clinic gets only `medical` " +
    "and `accident`. New alerts also arrive on the WebSocket as sos.new; until then the office " +
    "pages re-read this every 5 s.",
  tag: TAG,
  access: SOS_DESK,
  query: adminSosListQuerySchema,
  response: adminSosListSchema,
});

export const getAdminSosEndpoint = defineEndpoint({
  id: "emergencies.get",
  method: HttpMethod.Get,
  path: "/admin/sos/{sos_id}",
  summary:
    "One SOS with its log, the trip's bus and driver now, the crew's phone and any bus or " +
    "driver changes. Errors: NOT_FOUND (404, also for the clinic on a breakdown).",
  tag: TAG,
  access: SOS_DESK,
  params: adminSosParamsSchema,
  response: adminSosSchema,
});

export const addSosActionEndpoint = defineEndpoint({
  id: "emergencies.addAction",
  method: HttpMethod.Post,
  path: "/admin/sos/{sos_id}/actions",
  summary:
    "Logs what the office did, with who and when (the log is never edited). `acknowledge` " +
    "takes an open alert (the crew sees who took it); then `ambulance_called`, `note` (needs " +
    "`note`) and `close` (needs the summary in `note`). Closing tells the trip's students and " +
    "guardians it was handled. Errors: ALREADY_ACKNOWLEDGED, SOS_NOT_ACKNOWLEDGED, SOS_CLOSED " +
    "(409), NOTE_REQUIRED (422).",
  tag: TAG,
  access: SOS_DESK,
  idempotent: true,
  params: adminSosParamsSchema,
  body: sosActionBodySchema,
  response: adminSosSchema,
});

export const getReplacementOptionsEndpoint = defineEndpoint({
  id: "emergencies.replacementOptions",
  method: HttpMethod.Get,
  path: "/admin/trips/{trip_id}/replacement-options",
  summary:
    "The trip's bus and driver now, how many riders it carries, and the buses (each with its " +
    "driver) and drivers free to send today.",
  tag: TAG,
  access: TRANSPORT,
  params: tripParamsSchema,
  response: replacementOptionsSchema,
});

export const sendReplacementEndpoint = defineEndpoint({
  id: "emergencies.sendReplacement",
  method: HttpMethod.Post,
  path: "/admin/trips/{trip_id}/replacement",
  summary:
    "Sends another bus (with its own driver, or `driver_id`) or only another driver to a " +
    "trip that hasn't ended. Riders and attendance stay with the trip (business rule 10); the " +
    "crew, the line's students and their guardians see the new bus and driver at once, and " +
    "`sos_id` gets a `replacement_sent` line. Errors: TRIP_ALREADY_ENDED, BUS_NOT_AVAILABLE, " +
    "DRIVER_NOT_AVAILABLE, SOS_CLOSED (409), NOTHING_TO_CHANGE (422).",
  tag: TAG,
  access: TRANSPORT,
  idempotent: true,
  params: tripParamsSchema,
  body: replacementBodySchema,
  response: tripReplacementSchema,
});

export function listAdminSos(
  query: { status?: SosStatus } = {},
  options?: RequestOptions,
): Promise<AdminSosList> {
  return callEndpoint(listAdminSosEndpoint, { query }, options);
}

export function getAdminSos(sosId: string, options?: RequestOptions): Promise<AdminSos> {
  return callEndpoint(getAdminSosEndpoint, { params: { sos_id: sosId } }, options);
}

export function addSosAction(
  sosId: string,
  body: SosActionBody,
  options?: RequestOptions,
): Promise<AdminSos> {
  return callEndpoint(addSosActionEndpoint, { params: { sos_id: sosId }, body }, options);
}

export function getReplacementOptions(
  tripId: string,
  options?: RequestOptions,
): Promise<ReplacementOptions> {
  return callEndpoint(getReplacementOptionsEndpoint, { params: { trip_id: tripId } }, options);
}

export function sendReplacement(
  tripId: string,
  body: ReplacementBody,
  options?: RequestOptions,
): Promise<TripReplacement> {
  return callEndpoint(sendReplacementEndpoint, { params: { trip_id: tripId }, body }, options);
}

export const emergenciesEndpoints = [
  listAdminSosEndpoint,
  getAdminSosEndpoint,
  addSosActionEndpoint,
  getReplacementOptionsEndpoint,
  sendReplacementEndpoint,
];
