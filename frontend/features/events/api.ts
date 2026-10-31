import { z } from "zod";
import { call } from "@/lib/api/client";
import { defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/features/auth/roles";
import { CompanyDecision, EventBooking, NewEvent } from "./schema";

const OPERATIONS = [Role.SuperAdmin, Role.TransportAdmin] as const;

export const endpoints = {
  list: defineEndpoint({
    tag: "events",
    method: "GET",
    path: "/admin/events",
    summary: "Bus bookings for university events.",
    roles: OPERATIONS,
    response: z.array(EventBooking),
  }),
  create: defineEndpoint({
    tag: "events",
    method: "POST",
    path: "/admin/events",
    summary: "Book buses for an event: spare university buses first, the rest requested from the bus company.",
    roles: OPERATIONS,
    body: NewEvent,
    response: EventBooking,
    idempotent: true,
  }),
  cancel: defineEndpoint({
    tag: "events",
    method: "POST",
    path: "/admin/events/{event_id}/cancel",
    summary: "Cancel an event booking; the buses become spare again.",
    roles: OPERATIONS,
    response: EventBooking,
  }),
  companyRequests: defineEndpoint({
    tag: "bus-company",
    method: "GET",
    path: "/bus-company/requests",
    summary: "Bus requests sent to the bus company.",
    roles: [Role.SuperAdmin, Role.BusCompany],
    response: z.array(EventBooking),
  }),
  companyDecide: defineEndpoint({
    tag: "bus-company",
    method: "POST",
    path: "/bus-company/requests/{event_id}",
    summary: "The bus company confirms or declines.",
    roles: [Role.SuperAdmin, Role.BusCompany],
    body: CompanyDecision,
    response: EventBooking,
  }),
};

export const listEvents = () => call(endpoints.list);
export const createEvent = (body: z.infer<typeof NewEvent>) => call(endpoints.create, { body });
export const cancelEvent = (id: string) => call(endpoints.cancel, { params: { event_id: id } });
export const listCompanyRequests = () => call(endpoints.companyRequests);
export const companyDecide = (id: string, accept: boolean) =>
  call(endpoints.companyDecide, { params: { event_id: id }, body: { accept } });
