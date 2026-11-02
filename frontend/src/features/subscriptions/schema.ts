import { z } from "zod";
import { clockTimeSchema, lineSummarySchema } from "@/features/lines/schema";

/** A calendar day, "YYYY-MM-DD" (Cairo). Used for term dates and receipt dates. */
export const calendarDateSchema = z.iso.date();

/**
 * reserved → (receipt uploaded) payment_review → (finance approves) active.
 * A reservation not paid in time becomes expired and its seat is freed; a rejected receipt
 * sends it back to reserved with a fresh hold.
 */
export const SubscriptionStatus = {
  Reserved: "reserved",
  PaymentReview: "payment_review",
  Active: "active",
  Expired: "expired",
  Cancelled: "cancelled",
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

/** A student may book again only when they have no subscription or it ended. */
export const BOOKABLE_STATUSES: readonly SubscriptionStatus[] = [
  SubscriptionStatus.Expired,
  SubscriptionStatus.Cancelled,
];

export const SubscriptionErrorCode = {
  SeatUnavailable: "SEAT_UNAVAILABLE",
  AlreadySubscribed: "ALREADY_SUBSCRIBED",
  StopNotOnLine: "STOP_NOT_ON_LINE",
  NotCancellable: "NOT_CANCELLABLE",
} as const;

export const termSchema = z.object({
  term_id: z.string(),
  name: z.string(),
  starts_on: calendarDateSchema,
  ends_on: calendarDateSchema,
});
export type Term = z.infer<typeof termSchema>;

export const subscriptionStopSchema = z.object({
  stop_id: z.string(),
  name: z.string(),
  pickup_time: clockTimeSchema.nullable(),
});

/** The latest receipt on this subscription, enough for the home screen. */
export const latestPaymentSchema = z.object({
  payment_id: z.string(),
  status: z.enum(["pending_review", "approved", "rejected"]),
  rejection_reason: z.string().nullable(),
  submitted_at: z.iso.datetime(),
});

export const subscriptionSchema = z.object({
  subscription_id: z.string(),
  status: z.enum([
    SubscriptionStatus.Reserved,
    SubscriptionStatus.PaymentReview,
    SubscriptionStatus.Active,
    SubscriptionStatus.Expired,
    SubscriptionStatus.Cancelled,
  ]),
  term: termSchema,
  line: lineSummarySchema,
  stop: subscriptionStopSchema,
  /** Fixed when the seat was booked. */
  price_piasters: z.number().int().nonnegative(),
  reserved_at: z.iso.datetime(),
  /** While reserved: when the seat is released if no receipt arrives. Otherwise null. */
  hold_expires_at: z.iso.datetime().nullable(),
  activated_at: z.iso.datetime().nullable(),
  latest_payment: latestPaymentSchema.nullable(),
});
export type Subscription = z.infer<typeof subscriptionSchema>;

export const mySubscriptionSchema = z.object({ subscription: subscriptionSchema.nullable() });
export type MySubscription = z.infer<typeof mySubscriptionSchema>;

export const createSubscriptionBodySchema = z.object({
  line_id: z.string().min(1),
  stop_id: z.string().min(1),
});

export const subscriptionParamsSchema = z.object({ subscription_id: z.string().min(1) });
