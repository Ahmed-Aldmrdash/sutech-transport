import { z } from "zod";
import { call } from "@/lib/api/client";
import { defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/features/auth/roles";
import { RaiseSos, Replacement, Sos, SosAction } from "./schema";
import type { SosAction as SosActionInput, SosKind } from "./schema";

export const endpoints = {
  raise: defineEndpoint({
    tag: "sos",
    method: "POST",
    path: "/sos",
    summary: "Raise an SOS. Reaches the transport office at once; medical cases also reach the clinic.",
    roles: [Role.Driver, Role.Supervisor],
    body: RaiseSos,
    response: Sos,
    idempotent: true,
  }),
  get: defineEndpoint({
    tag: "sos",
    method: "GET",
    path: "/sos/{sos_id}",
    summary: "One SOS, for the crew that raised it.",
    roles: [Role.Driver, Role.Supervisor],
    response: Sos,
  }),
  list: defineEndpoint({
    tag: "sos",
    method: "GET",
    path: "/admin/sos",
    summary: "SOS cases, open first. The clinic sees medical cases only.",
    roles: [Role.SuperAdmin, Role.TransportAdmin, Role.Clinic],
    response: z.array(Sos),
  }),
  act: defineEndpoint({
    tag: "sos",
    method: "PATCH",
    path: "/admin/sos/{sos_id}",
    summary: "Acknowledge, request an ambulance, add a note, or close with what was done.",
    roles: [Role.SuperAdmin, Role.TransportAdmin, Role.Clinic],
    body: SosAction,
    response: Sos,
  }),
  replacement: defineEndpoint({
    tag: "sos",
    method: "POST",
    path: "/admin/trips/{trip_id}/replacement",
    summary:
      "Swap the bus (and its driver) on a running trip. Riders and attendance move to the new bus; the line's students are told.",
    roles: [Role.SuperAdmin, Role.TransportAdmin],
    body: Replacement,
    response: Sos.nullable(),
  }),
};

export const raiseSos = (tripId: string, kind: SosKind, note: string) =>
  call(endpoints.raise, { body: { trip_id: tripId, kind, note } });
export const getSos = (id: string) => call(endpoints.get, { params: { sos_id: id } });
export const listSos = () => call(endpoints.list);
export const actOnSos = (id: string, action: SosActionInput) =>
  call(endpoints.act, { params: { sos_id: id }, body: action });
export const replaceBus = (tripId: string, busId: string, reason: string) =>
  call(endpoints.replacement, { params: { trip_id: tripId }, body: { bus_id: busId, reason } });
