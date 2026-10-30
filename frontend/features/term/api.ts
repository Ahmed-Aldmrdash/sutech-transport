import { call } from "@/lib/api/client";
import { defineEndpoint } from "@/lib/api/endpoint";
import { ALL_ROLES, Role } from "@/features/auth/roles";
import { Term, UpdateBooking, UpdateNextTerm } from "./schema";
import type { RefundTier } from "./schema";

const TERM_ADMINS = [Role.SuperAdmin, Role.TransportAdmin] as const;

export const endpoints = {
  get: defineEndpoint({
    tag: "term",
    method: "GET",
    path: "/term",
    summary: "Current term, booking window, next term dates and the refund policy.",
    roles: ALL_ROLES,
    response: Term,
  }),
  setBooking: defineEndpoint({
    tag: "term",
    method: "PATCH",
    path: "/admin/term/booking",
    summary: "Open or close booking for the current term.",
    roles: TERM_ADMINS,
    body: UpdateBooking,
    response: Term,
  }),
  setNext: defineEndpoint({
    tag: "term",
    method: "PUT",
    path: "/admin/term/next",
    summary: "Set the next term's booking window; optionally schedule the booking-opened announcement.",
    roles: TERM_ADMINS,
    body: UpdateNextTerm,
    response: Term,
  }),
};

export const getTerm = () => call(endpoints.get);
export const setBooking = (booking: "open" | "closed") => call(endpoints.setBooking, { body: { booking } });
export const setNextTerm = (body: {
  name: string;
  booking_opens_on: string;
  booking_closes_on: string;
  starts_on: string;
  announce: boolean;
}) => call(endpoints.setNext, { body });

export function currentRefundTier(policy: RefundTier[], week: number): RefundTier | undefined {
  return policy.find((tier) => week >= tier.from_week && (tier.to_week === null || week <= tier.to_week));
}
