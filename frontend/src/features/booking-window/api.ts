import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/lib/auth/roles";
import {
  bookingWindowSchema,
  updateBookingWindowBodySchema,
  type BookingWindow,
  type UpdateBookingWindowBody,
} from "./schema";

const TAG = "booking-window";

export const getBookingWindowEndpoint = defineEndpoint({
  id: "bookingWindow.get",
  method: HttpMethod.Get,
  path: "/booking-window",
  summary:
    "The term's booking window: not_open, open (until closes_at) or closed. Students see it " +
    "on the lines page; the Transportation office also gets the history of its changes.",
  tag: TAG,
  access: [Role.Student, Role.Employee, Role.Transport, Role.SuperAdmin],
  response: bookingWindowSchema,
});

export const updateBookingWindowEndpoint = defineEndpoint({
  id: "bookingWindow.update",
  method: HttpMethod.Put,
  path: "/admin/booking-window",
  summary:
    "Opens booking (now or at opens_at, until closes_at), extends it (a later closes_at; a " +
    "closed window opens again) or closes it now. While it isn't open, POST /subscriptions " +
    "answers BOOKING_CLOSED (409) whatever the seats; reservations already made can still be " +
    "paid. Students without an active subscription are notified when booking opens or is " +
    "extended. Logged in the audit log. Errors: INVALID_WINDOW (422), EXTEND_MUST_BE_LATER " +
    "(422), NEVER_OPENED (409), ALREADY_CLOSED (409).",
  tag: TAG,
  access: [Role.Transport, Role.SuperAdmin],
  idempotent: true,
  body: updateBookingWindowBodySchema,
  response: bookingWindowSchema,
});

export function getBookingWindow(options?: RequestOptions): Promise<BookingWindow> {
  return callEndpoint(getBookingWindowEndpoint, {}, options);
}

export function updateBookingWindow(
  body: UpdateBookingWindowBody,
  options?: RequestOptions,
): Promise<BookingWindow> {
  return callEndpoint(updateBookingWindowEndpoint, { body }, options);
}

export const bookingWindowEndpoints = [getBookingWindowEndpoint, updateBookingWindowEndpoint];
