import { MockStorage, StoredMap } from "@/lib/api/mock/stored-map";
import { MOCK_TERM_PRICE_PIASTERS } from "@/features/lines/mock-builders";
import { DESK_SEED_BOOKINGS, DESK_SEED_PAYMENTS } from "./mock-desk-seeds";
import { SubscriptionStatus } from "./schema";

/**
 * The mock server's memory of each student's booking and receipts, shared by the
 * subscriptions, payments, card and trips mocks. Kept in localStorage so a demo continues
 * where it stopped. Only the mock uses this; the real rules live on the server.
 */

const MS_PER_HOUR = 3_600_000;

/** A booking holds the seat for 24 hours (agreement, business rule 2). */
export const MOCK_HOLD_MS = 24 * MS_PER_HOUR;

export const MOCK_TERM = {
  term_id: "2026-fall",
  nameAr: "الترم الأول 2026/2027",
  nameEn: "Fall 2026",
  starts_on: "2026-09-26",
  ends_on: "2027-01-21",
} as const;

export const MockPaymentStatus = {
  PendingReview: "pending_review",
  Approved: "approved",
  Rejected: "rejected",
} as const;
export type MockPaymentStatus = (typeof MockPaymentStatus)[keyof typeof MockPaymentStatus];

export interface MockBooking {
  subscriptionId: string;
  lineId: string;
  /** 1-based position of the chosen stop on the line. */
  stopOrder: number;
  status: SubscriptionStatus;
  pricePiasters: number;
  reservedAt: number;
  holdExpiresAt: number | null;
  activatedAt: number | null;
  /** Seeded demo bookings are already counted in the line's (full) seats. */
  seeded?: boolean;
}

export interface MockPayment {
  paymentId: string;
  subscriptionId: string;
  method: "bank_deposit" | "bank_transfer" | "card_at_office";
  referenceNumber: string;
  amountPiasters: number;
  paidOn: string;
  payerName: string;
  /** null for a Visa payment finance recorded at the office. */
  fileName: string | null;
  submittedAt: number;
  status: MockPaymentStatus;
  rejectionReason: { ar: string; en: string } | null;
  reviewedAt: number | null;
  /** The finance officer who reviewed or recorded it. Missing on receipts saved before. */
  reviewedBy?: { ar: string; en: string } | null;
}

const bookings = new StoredMap<MockBooking>("sut.mock.bookings", MockStorage.Local);
const payments = new StoredMap<MockPayment[]>("sut.mock.payments", MockStorage.Local);

/**
 * Seif (240100102) is already an active subscriber on line 7 (El Shorouk), to show the card at
 * once. Yassin (260100111, Ziad's brother in the demo) rides line 12 (Nasr City), so the
 * guardian's pages have a child on the bus.
 */
const SEED_ACTIVATED_AT = Date.parse("2026-09-20T09:12:00Z");
const SEED_BOOKINGS: Record<string, MockBooking> = {
  usr_student_2: {
    subscriptionId: "sub_seed_2",
    lineId: "ln_07",
    stopOrder: 2,
    status: SubscriptionStatus.Active,
    pricePiasters: MOCK_TERM_PRICE_PIASTERS,
    reservedAt: Date.parse("2026-09-14T10:02:00Z"),
    holdExpiresAt: null,
    activatedAt: SEED_ACTIVATED_AT,
    seeded: true,
  },
  usr_student_11: {
    subscriptionId: "sub_seed_11",
    lineId: "ln_12",
    stopOrder: 3,
    status: SubscriptionStatus.Active,
    pricePiasters: MOCK_TERM_PRICE_PIASTERS,
    reservedAt: Date.parse("2026-09-13T17:40:00Z"),
    holdExpiresAt: null,
    activatedAt: Date.parse("2026-09-16T11:05:00Z"),
    seeded: true,
  },
};
const SEED_PAYMENTS: Record<string, MockPayment[]> = {
  usr_student_2: [
    {
      paymentId: "pay_seed_2",
      subscriptionId: "sub_seed_2",
      method: "bank_deposit",
      referenceNumber: "NBE-48213377",
      amountPiasters: MOCK_TERM_PRICE_PIASTERS,
      paidOn: "2026-09-15",
      payerName: "Hossam Lotfy",
      fileName: "deposit-slip.jpg",
      submittedAt: Date.parse("2026-09-15T08:30:00Z"),
      status: MockPaymentStatus.Approved,
      rejectionReason: null,
      reviewedAt: SEED_ACTIVATED_AT,
    },
  ],
  usr_student_11: [
    {
      paymentId: "pay_seed_11",
      subscriptionId: "sub_seed_11",
      method: "bank_transfer",
      referenceNumber: "NBE-51902264",
      amountPiasters: MOCK_TERM_PRICE_PIASTERS,
      paidOn: "2026-09-14",
      payerName: "Tamer Nour",
      fileName: "transfer.pdf",
      submittedAt: Date.parse("2026-09-14T19:10:00Z"),
      status: MockPaymentStatus.Approved,
      rejectionReason: null,
      reviewedAt: Date.parse("2026-09-16T11:05:00Z"),
    },
  ],
};

Object.assign(SEED_BOOKINGS, DESK_SEED_BOOKINGS);
Object.assign(SEED_PAYMENTS, DESK_SEED_PAYMENTS);

export function paymentsOf(userId: string): MockPayment[] {
  return payments.get(userId) ?? SEED_PAYMENTS[userId] ?? [];
}

/** Every student with a receipt, stored or seeded (finance's queue reads them all). */
export function studentsWithPayments(): string[] {
  return [...new Set([...payments.keys(), ...Object.keys(SEED_PAYMENTS)])];
}

export function savePayments(userId: string, list: MockPayment[]): void {
  payments.set(userId, list);
}

export function saveBooking(userId: string, booking: MockBooking): void {
  bookings.set(userId, booking);
}

/**
 * The student's booking with time-based changes applied (the hold expiring). Receipts are
 * reviewed by finance on the office's payments page (FIN-1001), not by a timer.
 */
export function bookingOf(userId: string, now = Date.now()): MockBooking | undefined {
  const stored = bookings.get(userId) ?? SEED_BOOKINGS[userId];
  if (!stored) return undefined;
  let booking = stored;
  if (
    booking.status === SubscriptionStatus.Reserved &&
    booking.holdExpiresAt !== null &&
    booking.holdExpiresAt <= now
  ) {
    booking = { ...booking, status: SubscriptionStatus.Expired, holdExpiresAt: null };
  }
  if (booking !== stored) saveBooking(userId, booking);
  return booking;
}

const HOLDING_STATUSES: readonly SubscriptionStatus[] = [
  SubscriptionStatus.Reserved,
  SubscriptionStatus.PaymentReview,
  SubscriptionStatus.Active,
];

/** Seats taken by bookings made in this browser (seeded ones are already in the counts). */
export function seatsHeldOn(lineId: string): number {
  let held = 0;
  for (const userId of bookings.keys()) {
    const booking = bookingOf(userId);
    if (booking && !booking.seeded && booking.lineId === lineId) {
      if (HOLDING_STATUSES.includes(booking.status)) held += 1;
    }
  }
  return held;
}

export function newMockId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

/** Test helper: forget every booking and receipt. */
export function resetStudentMock(): void {
  bookings.clear();
  payments.clear();
}
