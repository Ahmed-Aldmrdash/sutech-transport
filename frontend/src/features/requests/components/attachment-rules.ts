"use client";

import { RECEIPT_CONTENT_TYPES } from "@/features/payments/schema";
import { MAX_ATTACHMENTS } from "../schema";
import { type Rejected } from "./attachments-field";

/** Splits newly picked files into the ones kept and the ones refused, with why. */
export function checkPicked(current: readonly File[], picked: readonly File[], maxBytes: number) {
  const kept: File[] = [];
  const rejected: Rejected[] = [];
  for (const file of picked) {
    if (!(RECEIPT_CONTENT_TYPES as readonly string[]).includes(file.type)) {
      rejected.push({ name: file.name, reason: "fileType" });
    } else if (file.size > maxBytes) {
      rejected.push({ name: file.name, reason: "fileTooLarge" });
    } else if (current.length + kept.length >= MAX_ATTACHMENTS) {
      rejected.push({ name: file.name, reason: "tooManyFiles" });
    } else {
      kept.push(file);
    }
  }
  return { kept, rejected };
}
