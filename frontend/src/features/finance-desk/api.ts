import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/lib/auth/roles";
import {
  awaitingPaymentQuerySchema,
  awaitingPaymentSchema,
  officePaymentDetailSchema,
  officePaymentListQuerySchema,
  officePaymentListSchema,
  officePaymentSchema,
  paymentParamsSchema,
  recordOfficePaymentBodySchema,
  reviewPaymentBodySchema,
  type AwaitingPayment,
  type OfficePayment,
  type OfficePaymentDetail,
  type OfficePaymentList,
  type OfficePaymentListQuery,
  type RecordOfficePaymentBody,
  type ReviewPaymentBody,
} from "./schema";

const TAG = "finance";
const FINANCE = [Role.SuperAdmin, Role.Finance];

export const listOfficePaymentsEndpoint = defineEndpoint({
  id: "finance.listPayments",
  method: HttpMethod.Get,
  path: "/admin/payments",
  summary:
    "Receipts and Visa payments this term with the student, line and reviewer. Filter by " +
    "`status` and search `q` (university ID, name or reference number). Waiting receipts come " +
    "first, oldest first; `counts` holds the totals per status for the tabs.",
  tag: TAG,
  access: FINANCE,
  query: officePaymentListQuerySchema,
  response: officePaymentListSchema,
});

export const getOfficePaymentEndpoint = defineEndpoint({
  id: "finance.getPayment",
  method: HttpMethod.Get,
  path: "/admin/payments/{payment_id}",
  summary:
    "One receipt with a short-lived `file_url` to the uploaded file and the student's other " +
    "receipts this term. Errors: NOT_FOUND (404).",
  tag: TAG,
  access: FINANCE,
  params: paymentParamsSchema,
  response: officePaymentDetailSchema,
});

export const reviewPaymentEndpoint = defineEndpoint({
  id: "finance.reviewPayment",
  method: HttpMethod.Patch,
  path: "/admin/payments/{payment_id}",
  summary:
    "Approve or reject a waiting receipt. Approving activates the subscription (the card " +
    "works at once); rejecting needs a `reason` the student sees and gives the seat a fresh " +
    "24-hour hold. The student gets a notification either way; logged in the audit log. " +
    "Errors: PAYMENT_ALREADY_REVIEWED (409), REASON_REQUIRED (422), NOT_FOUND (404).",
  tag: TAG,
  access: FINANCE,
  idempotent: true,
  params: paymentParamsSchema,
  body: reviewPaymentBodySchema,
  response: officePaymentSchema,
});

export const findAwaitingPaymentEndpoint = defineEndpoint({
  id: "finance.findAwaitingPayment",
  method: HttpMethod.Get,
  path: "/admin/bookings/awaiting-payment",
  summary:
    "At the cashier (A045): the booking of the student with this university ID, when it is " +
    "waiting for a payment. Errors: STUDENT_NOT_FOUND (404), NOT_AWAITING_PAYMENT (409), " +
    "HOLD_EXPIRED (409).",
  tag: TAG,
  access: FINANCE,
  query: awaitingPaymentQuerySchema,
  response: awaitingPaymentSchema,
});

export const recordOfficePaymentEndpoint = defineEndpoint({
  id: "finance.recordOfficePayment",
  method: HttpMethod.Post,
  path: "/admin/payments/office",
  summary:
    "Records a Visa payment taken at the Accounting office: approved at once, so the " +
    "subscription is active. Errors: NOT_AWAITING_PAYMENT (409), HOLD_EXPIRED (409), " +
    "RECEIPT_ALREADY_USED (409), AMOUNT_MISMATCH (422).",
  tag: TAG,
  access: FINANCE,
  idempotent: true,
  body: recordOfficePaymentBodySchema,
  response: officePaymentSchema,
});

export function listOfficePayments(
  query: OfficePaymentListQuery = {},
  options?: RequestOptions,
): Promise<OfficePaymentList> {
  return callEndpoint(listOfficePaymentsEndpoint, { query }, options);
}

export function getOfficePayment(
  paymentId: string,
  options?: RequestOptions,
): Promise<OfficePaymentDetail> {
  return callEndpoint(getOfficePaymentEndpoint, { params: { payment_id: paymentId } }, options);
}

export function reviewPayment(
  paymentId: string,
  body: ReviewPaymentBody,
  options?: RequestOptions,
): Promise<OfficePayment> {
  return callEndpoint(reviewPaymentEndpoint, { params: { payment_id: paymentId }, body }, options);
}

export function findAwaitingPayment(
  identifier: string,
  options?: RequestOptions,
): Promise<AwaitingPayment> {
  return callEndpoint(findAwaitingPaymentEndpoint, { query: { identifier } }, options);
}

export function recordOfficePayment(
  body: RecordOfficePaymentBody,
  options?: RequestOptions,
): Promise<OfficePayment> {
  return callEndpoint(recordOfficePaymentEndpoint, { body }, options);
}

export const financeDeskEndpoints = [
  listOfficePaymentsEndpoint,
  getOfficePaymentEndpoint,
  reviewPaymentEndpoint,
  findAwaitingPaymentEndpoint,
  recordOfficePaymentEndpoint,
];
