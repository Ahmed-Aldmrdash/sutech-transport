import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/lib/auth/roles";
import {
  createSubscriptionBodySchema,
  mySubscriptionSchema,
  subscriptionParamsSchema,
  subscriptionSchema,
  type MySubscription,
  type Subscription,
} from "./schema";

const TAG = "subscriptions";

export const getMySubscriptionEndpoint = defineEndpoint({
  id: "subscriptions.getMine",
  method: HttpMethod.Get,
  path: "/subscriptions/me",
  summary:
    "The student's subscription for the current term, or null if they have none. The server " +
    "moves an unpaid reservation to expired (and frees the seat) once hold_expires_at passes.",
  tag: TAG,
  access: [Role.Student],
  response: mySubscriptionSchema,
});

export const createSubscriptionEndpoint = defineEndpoint({
  id: "subscriptions.create",
  method: HttpMethod.Post,
  path: "/subscriptions",
  summary:
    "Books a seat on a line at one stop and holds it for 24 hours until a receipt arrives. " +
    "The price is fixed now. Errors: SEAT_UNAVAILABLE (409), ALREADY_SUBSCRIBED (409), " +
    "LINE_NOT_FOUND (404), STOP_NOT_ON_LINE (422).",
  tag: TAG,
  access: [Role.Student],
  idempotent: true,
  body: createSubscriptionBodySchema,
  response: subscriptionSchema,
});

export const cancelSubscriptionEndpoint = defineEndpoint({
  id: "subscriptions.cancel",
  method: HttpMethod.Post,
  path: "/subscriptions/{subscription_id}/cancel",
  summary:
    "Cancels a reservation that is not paid yet and frees the seat (to pick another line or " +
    "stop). Paid subscriptions go through a refund request instead. Errors: NOT_CANCELLABLE (409).",
  tag: TAG,
  access: [Role.Student],
  idempotent: true,
  params: subscriptionParamsSchema,
  response: subscriptionSchema,
});

export function getMySubscription(options?: RequestOptions): Promise<MySubscription> {
  return callEndpoint(getMySubscriptionEndpoint, {}, options);
}

export function createSubscription(
  lineId: string,
  stopId: string,
  options?: RequestOptions,
): Promise<Subscription> {
  return callEndpoint(
    createSubscriptionEndpoint,
    { body: { line_id: lineId, stop_id: stopId } },
    options,
  );
}

export function cancelSubscription(
  subscriptionId: string,
  options?: RequestOptions,
): Promise<Subscription> {
  return callEndpoint(
    cancelSubscriptionEndpoint,
    { params: { subscription_id: subscriptionId } },
    options,
  );
}

export const subscriptionsEndpoints = [
  getMySubscriptionEndpoint,
  createSubscriptionEndpoint,
  cancelSubscriptionEndpoint,
];
