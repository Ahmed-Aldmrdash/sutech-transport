import { z } from "zod";
import { calendarDateSchema } from "@/features/subscriptions/schema";

/**
 * How a term is paid (registration letter, Fall 2026): a deposit or transfer to the
 * university's National Bank of Egypt account, with the receipt uploaded here, or a Visa card
 * at the Accounting office (A045), which finance records itself. No Fawry, no InstaPay.
 */
export const PaymentMethod = {
  BankDeposit: "bank_deposit",
  BankTransfer: "bank_transfer",
  CardAtOffice: "card_at_office",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

/** The methods a student uploads a receipt for. */
export const RECEIPT_METHODS = [PaymentMethod.BankDeposit, PaymentMethod.BankTransfer] as const;
export type ReceiptMethod = (typeof RECEIPT_METHODS)[number];

export const PaymentStatus = {
  PendingReview: "pending_review",
  Approved: "approved",
  Rejected: "rejected",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PaymentErrorCode = {
  HoldExpired: "HOLD_EXPIRED",
  NotAwaitingPayment: "NOT_AWAITING_PAYMENT",
  ReceiptAlreadyUsed: "RECEIPT_ALREADY_USED",
  ReceiptTooLarge: "RECEIPT_TOO_LARGE",
  AmountMismatch: "AMOUNT_MISMATCH",
} as const;

export const RECEIPT_CONTENT_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export const REFERENCE_MAX_LENGTH = 40;
export const PAYER_NAME_MAX_LENGTH = 100;

/** Where and how to pay. From the server, so finance can change it without a new app. */
export const paymentInstructionsSchema = z.object({
  amount_piasters: z.number().int().positive(),
  bank: z.object({
    bank_name: z.string(),
    account_name: z.string(),
    account_number: z.string(),
    iban: z.string(),
    swift_code: z.string(),
    currency: z.string(),
  }),
  /** Accounting office for Visa payments, e.g. "A045". */
  cashier_room: z.string(),
  /** Transportation office, e.g. "A039". */
  transport_room: z.string(),
  /** "Sunday to Thursday, 9:00 AM to 4:00 PM", in the request's language. */
  office_hours: z.string(),
  receipt_max_bytes: z.number().int().positive(),
  receipt_content_types: z.array(z.string()),
});
export type PaymentInstructions = z.infer<typeof paymentInstructionsSchema>;

export const paymentSchema = z.object({
  payment_id: z.string(),
  subscription_id: z.string(),
  method: z.enum([
    PaymentMethod.BankDeposit,
    PaymentMethod.BankTransfer,
    PaymentMethod.CardAtOffice,
  ]),
  reference_number: z.string(),
  amount_piasters: z.number().int().nonnegative(),
  paid_on: calendarDateSchema,
  payer_name: z.string(),
  file_name: z.string().nullable(),
  submitted_at: z.iso.datetime(),
  status: z.enum([PaymentStatus.PendingReview, PaymentStatus.Approved, PaymentStatus.Rejected]),
  rejection_reason: z.string().nullable(),
  reviewed_at: z.iso.datetime().nullable(),
});
export type Payment = z.infer<typeof paymentSchema>;

export const receiptFileSchema = z.object({
  file_name: z.string().min(1).max(200),
  content_type: z.enum(RECEIPT_CONTENT_TYPES),
  /** The file itself, base64 (no "data:" prefix). At most 5 MB before encoding. */
  data_base64: z.string().min(1),
});
export type ReceiptFile = z.infer<typeof receiptFileSchema>;

export const submitReceiptBodySchema = z.object({
  subscription_id: z.string().min(1),
  method: z.enum(RECEIPT_METHODS),
  /** The bank's operation or slip number, as printed on the receipt. */
  reference_number: z.string().trim().min(3).max(REFERENCE_MAX_LENGTH),
  amount_piasters: z.number().int().positive(),
  paid_on: calendarDateSchema,
  /** The account holder (or depositor) shown on the receipt; often a parent. */
  payer_name: z.string().trim().min(3).max(PAYER_NAME_MAX_LENGTH),
  receipt: receiptFileSchema,
});
export type SubmitReceiptBody = z.infer<typeof submitReceiptBodySchema>;
