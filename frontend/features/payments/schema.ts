import { z } from "zod";
import { IsoDateTime, Money } from "@/lib/api/common";

export const FawryCode = z.object({
  code: z.string(),
  amount: Money,
  expires_at: IsoDateTime,
});
export type FawryCode = z.infer<typeof FawryCode>;

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export const ReceiptUpload = z.object({
  method: z.enum(["instapay", "bank_transfer"]),
  /** Transaction reference printed on the receipt. Unique across all payments. */
  reference: z
    .string()
    .trim()
    .min(6)
    .max(40)
    .regex(/^[A-Za-z0-9 -]+$/),
  /** The receipt image as a data URL (image/jpeg, image/png or image/webp). */
  image: z.string().startsWith("data:image/"),
});
export type ReceiptUpload = z.infer<typeof ReceiptUpload>;

export const AdminPayment = z.object({
  id: z.string(),
  student_id: z.string(),
  student_name: z.string(),
  line_name: z.string(),
  amount: Money,
  method: z.enum(["fawry", "instapay", "bank_transfer"]),
  reference: z.string(),
  created_at: IsoDateTime,
  status: z.enum(["pending", "approved", "rejected"]),
  /** Fawry payments are confirmed automatically by Fawry's callback. */
  automatic: z.boolean(),
  rejection_reason: z.string().nullable(),
  receipt_image: z.string().nullable(),
});
export type AdminPayment = z.infer<typeof AdminPayment>;

export const PaymentDecision = z.object({
  approve: z.boolean(),
  reason: z.string().trim().max(200).nullable(),
});
