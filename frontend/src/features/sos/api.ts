import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/lib/auth/roles";
import {
  createSosBodySchema,
  riderSosStateSchema,
  sosParamsSchema,
  sosSchema,
  type CreateSosBody,
  type RiderSosState,
  type Sos,
} from "./schema";

const TAG = "sos";
export const createSosEndpoint = defineEndpoint({
  id: "sos.create",
  method: HttpMethod.Post,
  path: "/sos",
  summary:
    "Raises an emergency on today's trip of the caller's bus. Any rider on a trip " +
    "that has started and not ended can raise it: the driver, the supervisor or a " +
    "subscribed student (an employee is added with the employee role). The server adds " +
    "the bus's latest position from its GPS device and the riders on board, records " +
    "who raised it (role, name and phone), sends sos.new to the Transportation office " +
    "(and the clinic for medical and accident), and notifies the trip's riders in calm " +
    "words. Guardians are never notified, when it is raised or when it is closed. A " +
    "rider who is not on a running trip cannot raise one. The same Idempotency-Key " +
    "never makes a second SOS (business rule 9). Errors: NOT_YOUR_TRIP (403), " +
    "NOT_ON_A_TRIP (409), TRIP_ALREADY_ENDED (409).",
  tag: TAG,
  access: [Role.Driver, Role.Supervisor, Role.Student, Role.Employee],
  idempotent: true,
  body: createSosBodySchema,
  response: sosSchema,
});

export const getSosEndpoint = defineEndpoint({
  id: "sos.get",
  method: HttpMethod.Get,
  path: "/sos/{sos_id}",
  summary:
    "One SOS with its action log, for the rider who raised it (or any rider on the " +
    "same bus's trip) to follow. Only riders of that trip can read it; the " +
    "guardian never can. Changes arrive on the WebSocket as sos.update; until then " +
    "the app re-reads it every 5 s while it is open. Errors: NOT_FOUND (404).",
  tag: TAG,
  access: [Role.Driver, Role.Supervisor, Role.Student, Role.Employee],
  params: sosParamsSchema,
  response: sosSchema,
});

export const getMyRiderSosEndpoint = defineEndpoint({
  id: "sos.getMine",
  method: HttpMethod.Get,
  path: "/me/sos",
  summary:
    "For the student's SOS page and buttons: the trip of their line that has started and " +
    "not ended (morning or return), and the latest SOS on it, whoever raised it, so an " +
    "open alert is followed instead of raising a second one. Both are null without an " +
    "active subscription or a running trip. The app re-reads it every 5 s.",
  tag: TAG,
  access: [Role.Student, Role.Employee],
  response: riderSosStateSchema,
});

export function createSos(body: CreateSosBody, options?: RequestOptions): Promise<Sos> {
  return callEndpoint(createSosEndpoint, { body }, options);
}

export function getSos(sosId: string, options?: RequestOptions): Promise<Sos> {
  return callEndpoint(getSosEndpoint, { params: { sos_id: sosId } }, options);
}

export function getMyRiderSos(options?: RequestOptions): Promise<RiderSosState> {
  return callEndpoint(getMyRiderSosEndpoint, {}, options);
}

export const sosEndpoints = [createSosEndpoint, getSosEndpoint, getMyRiderSosEndpoint];
