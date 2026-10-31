import { call } from "@/lib/api/client";
import { defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/features/auth/roles";
import { Subscription } from "@/features/subscriptions/schema";
import { z } from "zod";
import { AdminPayment, FawryCode, PaymentDecision, ReceiptUpload } from "./schema";

const STUDENT = [Role.Student] as const;

export const endpoints = {
  fawry: defineEndpoint({
    tag: "payments",
    method: "POST",
    path: "/payments/fawry",
    summary: "Create (or return the existing) Fawry reference for the reserved seat. Fawry confirms by callback.",
    roles: STUDENT,
    response: FawryCode,
    idempotent: true,
  }),
  receipt: defineEndpoint({
    tag: "payments",
    method: "POST",
    path: "/payments/receipt",
    summary: "Upload an InstaPay or bank transfer receipt for finance to review.",
    roles: STUDENT,
    body: ReceiptUpload,
    response: Subscription,
    idempotent: true,
  }),
  simulateFawry: defineEndpoint({
    tag: "mock",
    method: "POST",
    path: "/mock/fawry-paid",
    summary: "Mock server only: pretend Fawry's callback arrived.",
    roles: STUDENT,
    response: Subscription,
  }),
};

export const createFawryCode = () => call(endpoints.fawry);
export const uploadReceipt = (body: ReceiptUpload) => call(endpoints.receipt, { body });
export const simulateFawryPaid = () => call(endpoints.simulateFawry);

export const adminEndpoints = {
  list: defineEndpoint({
    tag: "payments",
    method: "GET",
    path: "/admin/payments",
    summary: "Payments, pending receipts first.",
    roles: [Role.SuperAdmin, Role.Finance],
    response: z.array(AdminPayment),
  }),
  decide: defineEndpoint({
    tag: "payments",
    method: "PATCH",
    path: "/admin/payments/{payment_id}",
    summary: "Approve a receipt (activates the subscription) or reject it with a reason.",
    roles: [Role.SuperAdmin, Role.Finance],
    body: PaymentDecision,
    response: AdminPayment,
  }),
};

export const listPayments = () => call(adminEndpoints.list);
export const decidePayment = (id: string, approve: boolean, reason: string | null = null) =>
  call(adminEndpoints.decide, { params: { payment_id: id }, body: { approve, reason } });
