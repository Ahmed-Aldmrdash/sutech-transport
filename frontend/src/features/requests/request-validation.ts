import { RECEIPT_CONTENT_TYPES } from "@/features/payments/schema";
import { toLatinDigits } from "@/lib/format";
import {
  EXCEPTIONAL_REFUND_REASONS,
  LineChangeDuration,
  MAX_ATTACHMENTS,
  ModelPurpose,
  REQUEST_TEXT_MAX_LENGTH,
  REQUEST_TEXT_MIN_LENGTH,
  SHORT_TEXT_MAX_LENGTH,
  SHORT_TEXT_MIN_LENGTH,
  type ComplaintCategory,
  type RefundReason,
} from "./schema";

/** Keys under `student.requests.errors` for each field's problem. */
export type RequestFieldError =
  | "required"
  | "phoneInvalid"
  | "textTooShort"
  | "textTooLong"
  | "nameTooShort"
  | "sameLine"
  | "dateInPast"
  | "dateInFuture"
  | "dateBeforeTerm"
  | "dateAfterTerm"
  | "endBeforeStart"
  | "exitBeforeEntry"
  | "shortTextTooShort"
  | "shortTextTooLong"
  | "consentRequired"
  | "declarationRequired"
  | "documentsRequired"
  | "tooManyFiles"
  | "fileType"
  | "fileTooLarge";

export type FieldErrors<K extends string> = Partial<Record<K, RequestFieldError>>;

/** The term's dates and today's date (Cairo), all "YYYY-MM-DD". */
export interface DateRules {
  today: string;
  termStartsOn: string;
  termEndsOn: string;
}

const MIN_NAME_LENGTH = 3;

/** Typed phone → "01xxxxxxxxx": Arabic digits, spaces, dashes and +20 are accepted. */
export function normalizePhone(phone: string): string {
  const digits = toLatinDigits(phone).replace(/[\s-]/g, "");
  return digits.startsWith("+20") ? `0${digits.slice(3)}` : digits;
}

export function isEgyptianMobile(phone: string): boolean {
  return /^01[0125]\d{8}$/.test(normalizePhone(phone));
}

function checkPhone(phone: string): RequestFieldError | undefined {
  if (!phone.trim()) return "required";
  return isEgyptianMobile(phone) ? undefined : "phoneInvalid";
}

function checkText(text: string): RequestFieldError | undefined {
  const length = text.trim().length;
  if (length === 0) return "required";
  if (length < REQUEST_TEXT_MIN_LENGTH) return "textTooShort";
  return length > REQUEST_TEXT_MAX_LENGTH ? "textTooLong" : undefined;
}

function checkShortText(text: string): RequestFieldError | undefined {
  const length = text.trim().length;
  if (length === 0) return "required";
  if (length < SHORT_TEXT_MIN_LENGTH) return "shortTextTooShort";
  return length > SHORT_TEXT_MAX_LENGTH ? "shortTextTooLong" : undefined;
}

function checkName(name: string): RequestFieldError | undefined {
  if (!name.trim()) return "required";
  return name.trim().length < MIN_NAME_LENGTH ? "nameTooShort" : undefined;
}

export function checkFiles(
  files: readonly File[],
  maxBytes: number,
): RequestFieldError | undefined {
  if (files.length > MAX_ATTACHMENTS) return "tooManyFiles";
  if (files.some((file) => !(RECEIPT_CONTENT_TYPES as readonly string[]).includes(file.type))) {
    return "fileType";
  }
  return files.some((file) => file.size > maxBytes) ? "fileTooLarge" : undefined;
}

/** Drops empty entries so the result can be checked with `Object.keys(...).length`. */
function compact<K extends string>(errors: Record<K, RequestFieldError | undefined>) {
  return Object.fromEntries(
    Object.entries(errors).filter(([, value]) => value !== undefined),
  ) as FieldErrors<K>;
}

export interface LineChangeValues {
  toLineId: string;
  toStopId: string;
  duration: LineChangeDuration;
  startsOn: string;
  endsOn: string;
  reason: string;
  studentPhone: string;
  guardianName: string;
  guardianPhone: string;
}
export type LineChangeField = keyof LineChangeValues;

export function validateLineChange(
  values: LineChangeValues,
  rules: DateRules & { currentLineId: string },
): FieldErrors<LineChangeField> {
  const isTemporary = values.duration === LineChangeDuration.Temporary;
  let startsOn: RequestFieldError | undefined;
  if (!values.startsOn) startsOn = "required";
  else if (values.startsOn < rules.today) startsOn = "dateInPast";
  else if (values.startsOn > rules.termEndsOn) startsOn = "dateAfterTerm";

  let endsOn: RequestFieldError | undefined;
  if (isTemporary) {
    if (!values.endsOn) endsOn = "required";
    else if (values.startsOn && values.endsOn < values.startsOn) endsOn = "endBeforeStart";
    else if (values.endsOn > rules.termEndsOn) endsOn = "dateAfterTerm";
  }

  let toLineId: RequestFieldError | undefined;
  if (!values.toLineId) toLineId = "required";
  else if (values.toLineId === rules.currentLineId) toLineId = "sameLine";

  return compact<LineChangeField>({
    toLineId,
    toStopId: values.toLineId && !values.toStopId ? "required" : undefined,
    duration: undefined,
    startsOn,
    endsOn,
    reason: checkText(values.reason),
    studentPhone: checkPhone(values.studentPhone),
    guardianName: checkName(values.guardianName),
    guardianPhone: checkPhone(values.guardianPhone),
  });
}

export interface RefundValues {
  reason: RefundReason | "";
  explanation: string;
  guardianName: string;
  guardianPhone: string;
  guardianConsent: boolean;
  documents: File[];
}
export type RefundField = keyof RefundValues;

export function validateRefund(
  values: RefundValues,
  rules: { maxBytes: number },
): FieldErrors<RefundField> {
  const needsDocuments = values.reason !== "" && EXCEPTIONAL_REFUND_REASONS.includes(values.reason);
  return compact<RefundField>({
    reason: values.reason ? undefined : "required",
    explanation: checkText(values.explanation),
    guardianName: checkName(values.guardianName),
    guardianPhone: checkPhone(values.guardianPhone),
    guardianConsent: values.guardianConsent ? undefined : "consentRequired",
    documents:
      needsDocuments && values.documents.length === 0
        ? "documentsRequired"
        : checkFiles(values.documents, rules.maxBytes),
  });
}

export interface ComplaintValues {
  category: ComplaintCategory | "";
  /** "" when it isn't about a line. */
  lineId: string;
  happenedOn: string;
  description: string;
  attachments: File[];
}
export type ComplaintField = keyof ComplaintValues;

export function validateComplaint(
  values: ComplaintValues,
  rules: DateRules & { maxBytes: number },
): FieldErrors<ComplaintField> {
  let happenedOn: RequestFieldError | undefined;
  if (!values.happenedOn) happenedOn = "required";
  else if (values.happenedOn > rules.today) happenedOn = "dateInFuture";
  else if (values.happenedOn < rules.termStartsOn) happenedOn = "dateBeforeTerm";

  return compact<ComplaintField>({
    category: values.category ? undefined : "required",
    lineId: undefined,
    happenedOn,
    description: checkText(values.description),
    attachments: checkFiles(values.attachments, rules.maxBytes),
  });
}

export interface ModelPermitValues {
  material: string;
  dimensions: string;
  purpose: ModelPurpose | "";
  purposeOther: string;
  destination: string;
  entryDate: string;
  entryTime: string;
  exitDate: string;
  exitTime: string;
  supervisorName: string;
  declarationAccepted: boolean;
}
export type ModelPermitField = keyof ModelPermitValues;

/** The model permit form: what the model is, why, when it comes in and out, and who signs. */
export function validateModelPermit(
  values: ModelPermitValues,
  rules: DateRules,
): FieldErrors<ModelPermitField> {
  let entryDate: RequestFieldError | undefined;
  if (!values.entryDate) entryDate = "required";
  else if (values.entryDate < rules.today) entryDate = "dateInPast";
  else if (values.entryDate > rules.termEndsOn) entryDate = "dateAfterTerm";

  let exitDate: RequestFieldError | undefined;
  if (!values.exitDate) exitDate = "required";
  else if (values.entryDate && values.exitDate < values.entryDate) exitDate = "exitBeforeEntry";
  else if (values.exitDate > rules.termEndsOn) exitDate = "dateAfterTerm";

  // Same day: the exit time must come after the entry time.
  let exitTime: RequestFieldError | undefined;
  if (!values.exitTime) exitTime = "required";
  else if (
    !exitDate &&
    values.exitDate === values.entryDate &&
    values.entryTime &&
    values.exitTime <= values.entryTime
  ) {
    exitTime = "exitBeforeEntry";
  }

  return compact<ModelPermitField>({
    material: checkShortText(values.material),
    dimensions: checkShortText(values.dimensions),
    purpose: values.purpose ? undefined : "required",
    purposeOther:
      values.purpose === ModelPurpose.Other ? checkShortText(values.purposeOther) : undefined,
    destination: checkShortText(values.destination),
    entryDate,
    entryTime: values.entryTime ? undefined : "required",
    exitDate,
    exitTime,
    supervisorName: checkName(values.supervisorName),
    declarationAccepted: values.declarationAccepted ? undefined : "declarationRequired",
  });
}
