import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/lib/auth/roles";
import {
  busEventSchema,
  cancelEventBodySchema,
  companyReplyBodySchema,
  companyRequestSchema,
  createEventBodySchema,
  eventListQuerySchema,
  eventListSchema,
  eventParamsSchema,
  fleetSchema,
  type BusEvent,
  type CancelEventBody,
  type CompanyReplyBody,
  type CompanyRequest,
  type CreateEventBody,
  type EventList,
  type EventListQuery,
  type Fleet,
} from "./schema";

const TAG = "event-buses";
const OFFICE = [Role.SuperAdmin, Role.Transport];
/** Reading the company's portal: Abu El Hol and the super admin (view only). */
const COMPANY = [Role.SuperAdmin, Role.BusCompany];
/** Answering a request: Abu El Hol only (the super admin gets 403). */
const COMPANY_ACTOR = [Role.BusCompany];

export const listEventsEndpoint = defineEndpoint({
  id: "events.list",
  method: HttpMethod.Get,
  path: "/admin/events",
  summary:
    "The Transportation office's event bus requests: waiting for Abu El Hol first, then the " +
    "coming days, then the past. Filter by `status`; `counts` holds the totals per status.",
  tag: TAG,
  access: OFFICE,
  query: eventListQuerySchema,
  response: eventListSchema,
});

export const getEventEndpoint = defineEndpoint({
  id: "events.get",
  method: HttpMethod.Get,
  path: "/admin/events/{event_id}",
  summary: "One event request with the company's answer. Errors: NOT_FOUND (404).",
  tag: TAG,
  access: OFFICE,
  params: eventParamsSchema,
  response: busEventSchema,
});

export const createEventEndpoint = defineEndpoint({
  id: "events.create",
  method: HttpMethod.Post,
  path: "/admin/events",
  summary:
    "Ask Abu El Hol for buses for an event. The day must be from tomorrow up to 120 days " +
    "ahead; the buses must seat the students. Errors: EVENT_DATE_INVALID, " +
    "EVENT_TIMES_INVALID, NOT_ENOUGH_SEATS (422), EVENT_DUPLICATE (409).",
  tag: TAG,
  access: OFFICE,
  idempotent: true,
  body: createEventBodySchema,
  response: busEventSchema,
});

export const cancelEventEndpoint = defineEndpoint({
  id: "events.cancel",
  method: HttpMethod.Post,
  path: "/admin/events/{event_id}/cancel",
  summary:
    "Call the event off, with a reason Abu El Hol reads. Only while waiting or confirmed and " +
    "before the day is over. Errors: EVENT_CLOSED (409), REASON_REQUIRED (422).",
  tag: TAG,
  access: OFFICE,
  idempotent: true,
  params: eventParamsSchema,
  body: cancelEventBodySchema,
  response: busEventSchema,
});

export const listCompanyRequestsEndpoint = defineEndpoint({
  id: "busCompany.listRequests",
  method: HttpMethod.Get,
  path: "/bus-company/requests",
  summary:
    "Abu El Hol's view of the event requests, same order and counts as the office's list. " +
    "No student data: only how many, when and where.",
  tag: TAG,
  access: COMPANY,
  query: eventListQuerySchema,
  response: eventListSchema,
});

export const getCompanyRequestEndpoint = defineEndpoint({
  id: "busCompany.getRequest",
  method: HttpMethod.Get,
  path: "/bus-company/requests/{event_id}",
  summary:
    "One request and the company's buses free that day (not sent to another event). " +
    "Errors: NOT_FOUND (404).",
  tag: TAG,
  access: COMPANY,
  params: eventParamsSchema,
  response: companyRequestSchema,
});

export const replyToRequestEndpoint = defineEndpoint({
  id: "busCompany.reply",
  method: HttpMethod.Post,
  path: "/bus-company/requests/{event_id}/reply",
  summary:
    "Confirm with 1 to `buses_requested` buses (each comes with its driver; fewer means a " +
    "partial answer), or decline with a reason. Errors: EVENT_NOT_WAITING, BUS_NOT_AVAILABLE " +
    "(409), BUSES_INVALID, REASON_REQUIRED (422), FORBIDDEN (403, super_admin: view only).",
  tag: TAG,
  access: COMPANY_ACTOR,
  idempotent: true,
  params: eventParamsSchema,
  body: companyReplyBodySchema,
  response: busEventSchema,
});

export const getFleetEndpoint = defineEndpoint({
  id: "busCompany.fleet",
  method: HttpMethod.Get,
  path: "/bus-company/fleet",
  summary:
    "Abu El Hol's buses with their drivers: the line each runs, the spares at the garage, " +
    "today's replacements and today's events.",
  tag: TAG,
  access: COMPANY,
  response: fleetSchema,
});

export function listEvents(
  query: EventListQuery = {},
  options?: RequestOptions,
): Promise<EventList> {
  return callEndpoint(listEventsEndpoint, { query }, options);
}

export function getEvent(eventId: string, options?: RequestOptions): Promise<BusEvent> {
  return callEndpoint(getEventEndpoint, { params: { event_id: eventId } }, options);
}

export function createEvent(body: CreateEventBody, options?: RequestOptions): Promise<BusEvent> {
  return callEndpoint(createEventEndpoint, { body }, options);
}

export function cancelEvent(
  eventId: string,
  body: CancelEventBody,
  options?: RequestOptions,
): Promise<BusEvent> {
  return callEndpoint(cancelEventEndpoint, { params: { event_id: eventId }, body }, options);
}

export function listCompanyRequests(
  query: EventListQuery = {},
  options?: RequestOptions,
): Promise<EventList> {
  return callEndpoint(listCompanyRequestsEndpoint, { query }, options);
}

export function getCompanyRequest(
  eventId: string,
  options?: RequestOptions,
): Promise<CompanyRequest> {
  return callEndpoint(getCompanyRequestEndpoint, { params: { event_id: eventId } }, options);
}

export function replyToRequest(
  eventId: string,
  body: CompanyReplyBody,
  options?: RequestOptions,
): Promise<BusEvent> {
  return callEndpoint(replyToRequestEndpoint, { params: { event_id: eventId }, body }, options);
}

export function getFleet(options?: RequestOptions): Promise<Fleet> {
  return callEndpoint(getFleetEndpoint, {}, options);
}

export const eventBusesEndpoints = [
  listEventsEndpoint,
  getEventEndpoint,
  createEventEndpoint,
  cancelEventEndpoint,
  listCompanyRequestsEndpoint,
  getCompanyRequestEndpoint,
  replyToRequestEndpoint,
  getFleetEndpoint,
];
