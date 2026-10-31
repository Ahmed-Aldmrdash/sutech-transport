import { z } from "zod";
import { Id, IsoDate, IsoDateTime, Money } from "@/lib/api/common";

export const SubscriptionStatus = {
  None: "none",
  Reserved: "reserved",
  PendingPayment: "pending_payment",
  Active: "active",
  Expired: "expired",
  Cancelled: "cancelled",
  Refunded: "refunded",
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const PaymentMethod = { Fawry: "fawry", InstaPay: "instapay", BankTransfer: "bank_transfer" } as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const AssignmentKind = { Today: "today", Temporary: "temporary", Permanent: "permanent" } as const;

export const Subscription = z.object({
  status: z.enum(Object.values(SubscriptionStatus) as [SubscriptionStatus, ...SubscriptionStatus[]]),
  id: Id.nullable(),
  term_name: z.string(),
  line_id: Id.nullable(),
  line_name: z.string().nullable(),
  stop_id: Id.nullable(),
  stop_name: z.string().nullable(),
  /** Price fixed at booking time. */
  price: Money.nullable(),
  reserved_until: IsoDateTime.nullable(),
  paid_amount: Money.nullable(),
  payment_method: z.enum(["fawry", "instapay", "bank_transfer"]).nullable(),
  /** Why finance rejected the last receipt; the student can upload again before reserved_until. */
  rejection_reason: z.string().nullable(),
  /** A transfer made by the transport office (one day, until a date, or permanent). */
  assignment: z
    .object({
      kind: z.enum(["today", "temporary", "permanent"]),
      line_id: Id,
      line_name: z.string(),
      until: IsoDate.nullable(),
    })
    .nullable(),
});
export type Subscription = z.infer<typeof Subscription>;

export const Reserve = z.object({ line_id: Id, stop_id: Id });

/** Statuses that hold a seat. A student can't book a second one while in any of them. */
export const LIVE_STATUSES: readonly SubscriptionStatus[] = [
  SubscriptionStatus.Reserved,
  SubscriptionStatus.PendingPayment,
  SubscriptionStatus.Active,
];

export function holdsSeat(subscription: Pick<Subscription, "status"> | undefined): boolean {
  return !!subscription && LIVE_STATUSES.includes(subscription.status);
}

export function isActive(subscription: Pick<Subscription, "status"> | undefined): boolean {
  return subscription?.status === SubscriptionStatus.Active;
}
