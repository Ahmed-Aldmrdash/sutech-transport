"use client";

import { useState } from "react";
import type { Subscription } from "@/features/subscriptions/schema";
import { errorMessageKey } from "@/lib/api/errors";
import { submitReceipt } from "../api";
import {
  poundsToPiasters,
  readFileAsBase64,
  validateReceipt,
  type ReceiptErrors,
  type ReceiptFormValues,
} from "../receipt-validation";
import { PaymentErrorCode, type PaymentInstructions, type ReceiptFile } from "../schema";

const SERVER_ERROR_CODES = Object.values(PaymentErrorCode);
export type ReceiptServerErrorKey =
  (typeof PaymentErrorCode)[keyof typeof PaymentErrorCode] | "network" | "generic";

interface Options {
  subscription: Subscription;
  instructions: PaymentInstructions;
  today: string;
  onInvalid: (errors: ReceiptErrors) => void;
  onSent: () => void;
}

/** Checks the form, reads the file and sends the receipt once, whatever the network does. */
export function useSendReceipt({ subscription, instructions, today, onInvalid, onSent }: Options) {
  const [serverError, setServerError] = useState<ReceiptServerErrorKey | null>(null);
  const [isSending, setIsSending] = useState(false);
  // One key per receipt: retrying after a lost answer can't create a second payment.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  async function send(values: ReceiptFormValues) {
    const found = validateReceipt(values, {
      minimumPiasters: subscription.price_piasters,
      maxBytes: instructions.receipt_max_bytes,
      today,
    });
    onInvalid(found);
    setServerError(null);
    if (Object.keys(found).length > 0 || !values.file) return;

    setIsSending(true);
    try {
      const receipt: ReceiptFile = {
        file_name: values.file.name,
        content_type: values.file.type as ReceiptFile["content_type"],
        data_base64: await readFileAsBase64(values.file),
      };
      await submitReceipt(
        {
          subscription_id: subscription.subscription_id,
          method: values.method,
          reference_number: values.reference.trim(),
          amount_piasters: poundsToPiasters(values.amount) ?? 0,
          paid_on: values.paidOn,
          payer_name: values.payer.trim(),
          receipt,
        },
        { idempotencyKey },
      );
      setIdempotencyKey(crypto.randomUUID());
      onSent();
    } catch (error) {
      setServerError(errorMessageKey(error, SERVER_ERROR_CODES));
    } finally {
      setIsSending(false);
    }
  }

  return { send, isSending, serverError };
}
