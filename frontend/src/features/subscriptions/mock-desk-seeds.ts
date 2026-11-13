import { MOCK_TERM_PRICE_PIASTERS } from "@/features/lines/mock-builders";
import type { MockBooking, MockPayment } from "./mock-state";
import { SubscriptionStatus } from "./schema";

/**
 * Bookings and receipts of the made-up desk students (mock-desk-students.ts), so finance has
 * receipts to review and a seat to take a Visa payment for. Fixed dates, so the demo looks the
 * same on every machine. Mock only.
 */

const FINANCE_OFFICER = { ar: "نادية سمير", en: "Nadia Samir" };
const HOURS_TO_PAY = 18;
const MS_PER_HOUR = 3_600_000;

const active = (
  subscriptionId: string,
  lineId: string,
  stopOrder: number,
  reservedAt: string,
  activatedAt: string,
): MockBooking => ({
  subscriptionId,
  lineId,
  stopOrder,
  status: SubscriptionStatus.Active,
  pricePiasters: MOCK_TERM_PRICE_PIASTERS,
  reservedAt: Date.parse(reservedAt),
  holdExpiresAt: null,
  activatedAt: Date.parse(activatedAt),
  seeded: true,
});

const inReview = (
  subscriptionId: string,
  lineId: string,
  stopOrder: number,
  reservedAt: string,
): MockBooking => ({
  subscriptionId,
  lineId,
  stopOrder,
  status: SubscriptionStatus.PaymentReview,
  pricePiasters: MOCK_TERM_PRICE_PIASTERS,
  reservedAt: Date.parse(reservedAt),
  holdExpiresAt: null,
  activatedAt: null,
  seeded: true,
});

export const DESK_SEED_BOOKINGS: Record<string, MockBooking> = {
  usr_desk_51: inReview("sub_desk_51", "ln_05", 2, "2026-11-10T16:20:00Z"),
  usr_desk_52: inReview("sub_desk_52", "ln_09", 1, "2026-11-08T18:05:00Z"),
  usr_desk_53: inReview("sub_desk_53", "ln_12", 2, "2026-11-12T09:30:00Z"),
  // Youssef booked and will pay by Visa at A045: the hold is always a few hours from now.
  usr_desk_54: {
    subscriptionId: "sub_desk_54",
    lineId: "ln_15",
    stopOrder: 1,
    status: SubscriptionStatus.Reserved,
    pricePiasters: MOCK_TERM_PRICE_PIASTERS,
    reservedAt: Date.now() - 2 * MS_PER_HOUR,
    holdExpiresAt: Date.now() + HOURS_TO_PAY * MS_PER_HOUR,
    activatedAt: null,
    seeded: true,
  },
  usr_desk_55: active("sub_desk_55", "ln_07", 3, "2026-09-13T11:00:00Z", "2026-09-15T10:20:00Z"),
  usr_desk_56: active("sub_desk_56", "ln_04", 2, "2026-09-12T15:40:00Z", "2026-09-14T09:05:00Z"),
  usr_desk_57: active("sub_desk_57", "ln_09", 2, "2026-09-14T08:10:00Z", "2026-09-16T12:30:00Z"),
  usr_desk_58: active("sub_desk_58", "ln_12", 1, "2026-09-15T19:00:00Z", "2026-09-17T09:45:00Z"),
};

const receipt = (
  paymentId: string,
  subscriptionId: string,
  details: Pick<MockPayment, "method" | "referenceNumber" | "paidOn" | "payerName" | "fileName">,
  submittedAt: string,
  review: {
    status: "approved" | "rejected";
    at: string;
    reason?: MockPayment["rejectionReason"];
  } | null,
): MockPayment => ({
  paymentId,
  subscriptionId,
  ...details,
  amountPiasters: MOCK_TERM_PRICE_PIASTERS,
  submittedAt: Date.parse(submittedAt),
  status: review?.status ?? "pending_review",
  rejectionReason: review?.reason ?? null,
  reviewedAt: review ? Date.parse(review.at) : null,
  reviewedBy: review ? FINANCE_OFFICER : null,
});

export const DESK_SEED_PAYMENTS: Record<string, MockPayment[]> = {
  usr_desk_51: [
    receipt(
      "pay_desk_51",
      "sub_desk_51",
      {
        method: "bank_deposit",
        referenceNumber: "NBE-60218835",
        paidOn: "2026-11-11",
        payerName: "Adel Hamdy",
        fileName: "deposit-slip.jpg",
      },
      "2026-11-11T07:40:00Z",
      null,
    ),
  ],
  usr_desk_52: [
    receipt(
      "pay_desk_52a",
      "sub_desk_52",
      {
        method: "bank_transfer",
        referenceNumber: "NBE-6044190",
        paidOn: "2026-11-09",
        payerName: "Ayman Sabry",
        fileName: "transfer.png",
      },
      "2026-11-09T09:15:00Z",
      {
        status: "rejected",
        at: "2026-11-09T12:40:00Z",
        reason: {
          ar: "رقم العملية مش ظاهر في كشف الحساب. اتأكد منه وارفع الإيصال تاني.",
          en: "The reference number doesn't appear on the bank statement. Check it and upload again.",
        },
      },
    ),
    receipt(
      "pay_desk_52b",
      "sub_desk_52",
      {
        method: "bank_transfer",
        referenceNumber: "NBE-60441902",
        paidOn: "2026-11-09",
        payerName: "Ayman Sabry",
        fileName: "transfer-2.png",
      },
      "2026-11-12T10:15:00Z",
      null,
    ),
  ],
  usr_desk_53: [
    receipt(
      "pay_desk_53",
      "sub_desk_53",
      {
        method: "bank_deposit",
        referenceNumber: "NBE-60513377",
        paidOn: "2026-11-12",
        payerName: "Saad El Din Mahmoud",
        fileName: "receipt.pdf",
      },
      "2026-11-12T12:05:00Z",
      null,
    ),
  ],
  usr_desk_55: [
    receipt(
      "pay_desk_55",
      "sub_desk_55",
      {
        method: "bank_deposit",
        referenceNumber: "NBE-48300121",
        paidOn: "2026-09-14",
        payerName: "Ashraf Kamal",
        fileName: "deposit.jpg",
      },
      "2026-09-14T08:00:00Z",
      { status: "approved", at: "2026-09-15T10:20:00Z" },
    ),
  ],
  usr_desk_56: [
    receipt(
      "pay_desk_56",
      "sub_desk_56",
      {
        method: "card_at_office",
        referenceNumber: "POS-118204",
        paidOn: "2026-09-14",
        payerName: "Tarek Fouad",
        fileName: null,
      },
      "2026-09-14T09:05:00Z",
      { status: "approved", at: "2026-09-14T09:05:00Z" },
    ),
  ],
  usr_desk_57: [
    receipt(
      "pay_desk_57",
      "sub_desk_57",
      {
        method: "bank_transfer",
        referenceNumber: "NBE-48419930",
        paidOn: "2026-09-15",
        payerName: "Wael Ezzat",
        fileName: "transfer.pdf",
      },
      "2026-09-15T18:30:00Z",
      { status: "approved", at: "2026-09-16T12:30:00Z" },
    ),
  ],
  usr_desk_58: [
    receipt(
      "pay_desk_58",
      "sub_desk_58",
      {
        method: "bank_deposit",
        referenceNumber: "NBE-48522718",
        paidOn: "2026-09-16",
        payerName: "Sherif Mounir",
        fileName: "slip.jpg",
      },
      "2026-09-16T10:10:00Z",
      { status: "approved", at: "2026-09-17T09:45:00Z" },
    ),
  ],
};
