import { readFileAsBase64 } from "@/features/payments/receipt-validation";
import { PaymentErrorCode, type ReceiptFile } from "@/features/payments/schema";
import { LineErrorCode } from "@/features/lines/schema";
import { SubscriptionErrorCode } from "@/features/subscriptions/schema";
import { RequestErrorCode } from "../schema";

/** Server codes the request forms have their own words for (`student.requests.serverErrors`). */
export const REQUEST_SERVER_ERRORS = [
  ...Object.values(RequestErrorCode),
  LineErrorCode.LineNotFound,
  SubscriptionErrorCode.StopNotOnLine,
  PaymentErrorCode.ReceiptTooLarge,
] as const;

/** Chosen files as the JSON request carries them (base64, like receipts). */
export function toUploads(files: readonly File[]): Promise<ReceiptFile[]> {
  return Promise.all(
    files.map(async (file) => ({
      file_name: file.name,
      content_type: file.type as ReceiptFile["content_type"],
      data_base64: await readFileAsBase64(file),
    })),
  );
}
