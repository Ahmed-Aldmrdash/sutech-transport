import { z } from "zod";
import { call } from "@/lib/api/client";
import { Ok } from "@/lib/api/common";
import { defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/features/auth/roles";
import { Departure, Lecture, NewDeparture } from "./schema";

const OPERATIONS = [Role.SuperAdmin, Role.TransportAdmin] as const;

export const endpoints = {
  list: defineEndpoint({
    tag: "departures",
    method: "GET",
    path: "/departures",
    summary: "Today's extra return trips.",
    roles: [Role.Student, ...OPERATIONS],
    response: z.array(Departure),
  }),
  join: defineEndpoint({
    tag: "departures",
    method: "POST",
    path: "/departures/{departure_id}/join",
    summary: "Book a seat on an extra trip (active subscribers).",
    roles: [Role.Student],
    response: Ok,
    idempotent: true,
  }),
  leave: defineEndpoint({
    tag: "departures",
    method: "POST",
    path: "/departures/{departure_id}/leave",
    summary: "Give the seat back.",
    roles: [Role.Student],
    response: Ok,
  }),
  create: defineEndpoint({
    tag: "departures",
    method: "POST",
    path: "/admin/departures",
    summary: "Announce an extra return trip; the line's students are notified.",
    roles: OPERATIONS,
    body: NewDeparture,
    response: Departure,
    idempotent: true,
  }),
  cancel: defineEndpoint({
    tag: "departures",
    method: "POST",
    path: "/admin/departures/{departure_id}/cancel",
    summary: "Cancel an extra trip; booked students are notified.",
    roles: OPERATIONS,
    response: Ok,
  }),
  lectures: defineEndpoint({
    tag: "departures",
    method: "GET",
    path: "/admin/lectures/today",
    summary: "When each group's last lecture ends today, to suggest return trips.",
    roles: OPERATIONS,
    response: z.array(Lecture),
  }),
};

export const listDepartures = () => call(endpoints.list);
export const joinDeparture = (id: string) => call(endpoints.join, { params: { departure_id: id } });
export const leaveDeparture = (id: string) => call(endpoints.leave, { params: { departure_id: id } });
export const createDeparture = (body: z.infer<typeof NewDeparture>) => call(endpoints.create, { body });
export const cancelDeparture = (id: string) => call(endpoints.cancel, { params: { departure_id: id } });
export const listLectures = () => call(endpoints.lectures);
