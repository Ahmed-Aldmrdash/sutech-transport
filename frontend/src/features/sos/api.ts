import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/lib/auth/roles";
import {
  createSosBodySchema,
  sosParamsSchema,
  sosSchema,
  type CreateSosBody,
  type Sos,
} from "./schema";

const TAG = "sos";

export const createSosEndpoint = defineEndpoint({
  id: "sos.create",
  method: HttpMethod.Post,
  path: "/sos",
  summary:
    "Raises an emergency on today's trip of the caller's bus. The server adds the bus's " +
    "latest position from its GPS device and the riders on board, sends sos.new to the " +
    "Transportation office (and the clinic for medical and accident), and notifies the " +
    "trip's students and guardians in calm words. The same Idempotency-Key never makes a " +
    "second SOS (business rule 9). Errors: NOT_YOUR_TRIP (403), TRIP_ALREADY_ENDED (409).",
  tag: TAG,
  access: [Role.Driver, Role.Supervisor],
  idempotent: true,
  body: createSosBodySchema,
  response: sosSchema,
});

export const getSosEndpoint = defineEndpoint({
  id: "sos.get",
  method: HttpMethod.Get,
  path: "/sos/{sos_id}",
  summary:
    "One SOS with its action log, for the crew member who raised it (or their bus's other " +
    "crew member) to follow. Changes arrive on the WebSocket as sos.update; until then the " +
    "app re-reads it every 5 s while it is open. Errors: NOT_FOUND (404).",
  tag: TAG,
  access: [Role.Driver, Role.Supervisor],
  params: sosParamsSchema,
  response: sosSchema,
});

export function createSos(body: CreateSosBody, options?: RequestOptions): Promise<Sos> {
  return callEndpoint(createSosEndpoint, { body }, options);
}

export function getSos(sosId: string, options?: RequestOptions): Promise<Sos> {
  return callEndpoint(getSosEndpoint, { params: { sos_id: sosId } }, options);
}

export const sosEndpoints = [createSosEndpoint, getSosEndpoint];
