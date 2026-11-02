import { z } from "zod";
import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/lib/auth/roles";
import {
  paymentInstructionsSchema,
  paymentSchema,
  submitReceiptBodySchema,
  type Payment,
  type PaymentInstructions,
  type SubmitReceiptBody,
} from "./schema";

const TAG = "payments";

export const getPaymentInstructionsEndpoint = defineEndpoint({
  id: "payments.getInstructions",
  method: HttpMethod.Get,
  path: "/payments/instructions",
  summary:
    "Term price, the university's bank account (NBE) and the offices for paying by Visa. " +
    "Office hours follow Accept-Language.",
  tag: TAG,
  access: [Role.Student],
  response: paymentInstructionsSchema,
});

export const listMyPaymentsEndpoint = defineEndpoint({
  id: "payments.listMine",
  method: HttpMethod.Get,
  path: "/payments/me",
  summary: "The student's receipts this term, oldest first, each with its review status.",
  tag: TAG,
  access: [Role.Student],
  response: z.array(paymentSchema),
});

export const submitReceiptEndpoint = defineEndpoint({
  id: "payments.submitReceipt",
  method: HttpMethod.Post,
  path: "/payments/receipt",
  summary:
    "Uploads a bank deposit or transfer receipt for a reserved seat. The seat stays held while " +
    "finance reviews it. Errors: HOLD_EXPIRED (409), NOT_AWAITING_PAYMENT (409), " +
    "RECEIPT_ALREADY_USED (409), RECEIPT_TOO_LARGE (413), AMOUNT_MISMATCH (422).",
  tag: TAG,
  access: [Role.Student],
  idempotent: true,
  body: submitReceiptBodySchema,
  response: paymentSchema,
});

export function getPaymentInstructions(options?: RequestOptions): Promise<PaymentInstructions> {
  return callEndpoint(getPaymentInstructionsEndpoint, {}, options);
}

export function listMyPayments(options?: RequestOptions): Promise<Payment[]> {
  return callEndpoint(listMyPaymentsEndpoint, {}, options);
}

export function submitReceipt(body: SubmitReceiptBody, options?: RequestOptions): Promise<Payment> {
  return callEndpoint(submitReceiptEndpoint, { body }, options);
}

export const paymentsEndpoints = [
  getPaymentInstructionsEndpoint,
  listMyPaymentsEndpoint,
  submitReceiptEndpoint,
];
