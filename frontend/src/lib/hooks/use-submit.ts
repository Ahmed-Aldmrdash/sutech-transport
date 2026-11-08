"use client";

import { useState } from "react";
import { errorMessageKey } from "@/lib/api/errors";

/**
 * Sends a form once, whatever the network does: one idempotency key per submission, kept on
 * retry and renewed only after success. Server error codes the screen knows become its own
 * message keys; a request the client refuses to send is "invalid" (a validation message);
 * anything else is "network" or "generic".
 */
export function useSubmit<TCode extends string>(knownCodes: readonly TCode[]) {
  const [serverError, setServerError] = useState<TCode | "network" | "invalid" | "generic" | null>(
    null,
  );
  const [isSending, setIsSending] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  async function submit<T>(send: (idempotencyKey: string) => Promise<T>): Promise<T | null> {
    setServerError(null);
    setIsSending(true);
    try {
      const result = await send(idempotencyKey);
      setIdempotencyKey(crypto.randomUUID());
      return result;
    } catch (error) {
      setServerError(errorMessageKey(error, knownCodes));
      return null;
    } finally {
      setIsSending(false);
    }
  }

  return { submit, isSending, serverError, clearServerError: () => setServerError(null) };
}
