import { call } from "@/lib/api/client";
import { defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/features/auth/roles";
import { Reserve, Subscription } from "./schema";

const STUDENT = [Role.Student] as const;

export const endpoints = {
  mine: defineEndpoint({
    tag: "subscriptions",
    method: "GET",
    path: "/subscriptions/me",
    summary: "The student's subscription for the current term (status none when there is none).",
    roles: STUDENT,
    response: Subscription,
  }),
  reserve: defineEndpoint({
    tag: "subscriptions",
    method: "POST",
    path: "/subscriptions",
    summary: "Reserve a seat on a line at a stop. Holds the seat 24 hours and fixes the price.",
    roles: STUDENT,
    body: Reserve,
    response: Subscription,
    idempotent: true,
  }),
  cancelReservation: defineEndpoint({
    tag: "subscriptions",
    method: "POST",
    path: "/subscriptions/me/cancel",
    summary: "Cancel an unpaid reservation and release the seat.",
    roles: STUDENT,
    response: Subscription,
    idempotent: true,
  }),
};

export const getMySubscription = () => call(endpoints.mine);
export const reserveSeat = (lineId: string, stopId: string) =>
  call(endpoints.reserve, { body: { line_id: lineId, stop_id: stopId } });
export const cancelReservation = () => call(endpoints.cancelReservation);
