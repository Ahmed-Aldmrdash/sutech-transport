import { PIASTERS_PER_POUND, toLatinDigits } from "@/lib/format";
import {
  PAYER_NAME_MAX_LENGTH,
  RECEIPT_CONTENT_TYPES,
  REFERENCE_MAX_LENGTH,
  type ReceiptMethod,
} from "./schema";

export interface ReceiptFormValues {
  method: ReceiptMethod;
  reference: string;
  /** Pounds, as typed (Arabic digits allowed). */
  amount: string;
  /** "YYYY-MM-DD" from the date picker. */
  paidOn: string;
  payer: string;
  file: File | null;
}

/** Keys under `student.payment.receipt` for each field's problem. */
export type ReceiptFieldError =
  | "required"
  | "referenceTooShort"
  | "amountInvalid"
  | "amountTooLow"
  | "amountTooHigh"
  | "dateInFuture"
  | "dateTooEarly"
  | "payerTooShort"
  | "fileMissing"
  | "fileType"
  | "fileTooLarge";

export type ReceiptErrors = Partial<
  Record<"reference" | "amount" | "paidOn" | "payer" | "file", ReceiptFieldError>
>;

const MIN_REFERENCE_LENGTH = 3;
const MIN_PAYER_LENGTH = 3;
/**
 * A receipt may be a little over the price (a bank's own fee added to the deposit), never far
 * over it: a much bigger number is almost always a typo, and money paid twice is a refund.
 */
const MAX_OVER_PRICE = 1.1;

interface ReceiptRules {
  /** The term's price: the least a receipt may show. */
  minimumPiasters: number;
  maxBytes: number;
  /** Cairo today, "YYYY-MM-DD": no payment date after it. */
  today: string;
  /** The day the seat was held, "YYYY-MM-DD": no payment for it can be older. */
  earliestPaidOn: string;
}

/** The most a receipt may show for this price. */
export function maximumPiastersFor(minimumPiasters: number): number {
  return Math.round(minimumPiasters * MAX_OVER_PRICE);
}

/** Pounds typed by the student → piasters, or null when it isn't a number. */
export function poundsToPiasters(amount: string): number | null {
  const normalized = toLatinDigits(amount.trim());
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * PIASTERS_PER_POUND);
}

/** Checks the form like the server will, so most mistakes show before sending. */
export function validateReceipt(values: ReceiptFormValues, rules: ReceiptRules): ReceiptErrors {
  const errors: ReceiptErrors = {};
  const reference = values.reference.trim();
  if (!reference) errors.reference = "required";
  else if (reference.length < MIN_REFERENCE_LENGTH || reference.length > REFERENCE_MAX_LENGTH)
    errors.reference = "referenceTooShort";

  const piasters = poundsToPiasters(values.amount);
  if (!values.amount.trim()) errors.amount = "required";
  else if (piasters === null) errors.amount = "amountInvalid";
  else if (piasters < rules.minimumPiasters) errors.amount = "amountTooLow";
  else if (piasters > maximumPiastersFor(rules.minimumPiasters)) errors.amount = "amountTooHigh";

  if (!values.paidOn) errors.paidOn = "required";
  else if (values.paidOn > rules.today) errors.paidOn = "dateInFuture";
  else if (values.paidOn < rules.earliestPaidOn) errors.paidOn = "dateTooEarly";

  const payer = values.payer.trim();
  if (!payer) errors.payer = "required";
  else if (payer.length < MIN_PAYER_LENGTH || payer.length > PAYER_NAME_MAX_LENGTH)
    errors.payer = "payerTooShort";

  if (!values.file) errors.file = "fileMissing";
  else if (!(RECEIPT_CONTENT_TYPES as readonly string[]).includes(values.file.type))
    errors.file = "fileType";
  else if (values.file.size > rules.maxBytes) errors.file = "fileTooLarge";

  return errors;
}

/** Reads a file as base64 (without the "data:…;base64," prefix) for the JSON request. */
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}
