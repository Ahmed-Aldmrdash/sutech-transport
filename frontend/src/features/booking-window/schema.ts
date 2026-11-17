import { z } from "zod";
import { isoDateTime } from "@/lib/api/iso-datetime";

/**
 * The term's booking window. The Transportation office opens booking for a set time; once it
 * closes nobody can book a seat, even on a line with free seats, until the office (or the super
 * admin) extends it or opens it again. Paying for a seat already booked is not affected.
 */
export const BookingWindowStatus = {
  /** Never opened this term, or opens later (opens_at in the future). */
  NotOpen: "not_open",
  Open: "open",
  Closed: "closed",
} as const;
export type BookingWindowStatus = (typeof BookingWindowStatus)[keyof typeof BookingWindowStatus];
const STATUSES = Object.values(BookingWindowStatus) as [
  BookingWindowStatus,
  ...BookingWindowStatus[],
];

export const BookingWindowAction = {
  /** Opens booking (now or at opens_at) until closes_at. Also re-opens a closed window. */
  Open: "open",
  /** Moves closes_at later; a window that already closed opens again until then. */
  Extend: "extend",
  /** Closes booking now. */
  Close: "close",
} as const;
export type BookingWindowAction = (typeof BookingWindowAction)[keyof typeof BookingWindowAction];
const ACTIONS = Object.values(BookingWindowAction) as [
  BookingWindowAction,
  ...BookingWindowAction[],
];

export const BookingWindowErrorCode = {
  /** Booking is closed (or not open yet): no new seat can be booked. */
  BookingClosed: "BOOKING_CLOSED",
  /** closes_at must be in the future and after opens_at. */
  InvalidWindow: "INVALID_WINDOW",
  /** An extension must end later than the current closing time. */
  ExtendMustBeLater: "EXTEND_MUST_BE_LATER",
  /** Extending or closing a window that was never opened. */
  NeverOpened: "NEVER_OPENED",
  AlreadyClosed: "ALREADY_CLOSED",
} as const;

export const NOTE_MAX_LENGTH = 200;

const historyEntrySchema = z.object({
  action: z.enum(ACTIONS),
  opens_at: isoDateTime().nullable(),
  closes_at: isoDateTime().nullable(),
  note: z.string().nullable(),
  by_name: z.string(),
  at: isoDateTime(),
});
export type BookingWindowHistoryEntry = z.infer<typeof historyEntrySchema>;

export const bookingWindowSchema = z.object({
  term_name: z.string(),
  status: z.enum(STATUSES),
  /** null until the office opens booking. */
  opens_at: isoDateTime().nullable(),
  closes_at: isoDateTime().nullable(),
  /** The office's changes, newest first. Empty for students. */
  history: z.array(historyEntrySchema),
});
export type BookingWindow = z.infer<typeof bookingWindowSchema>;

export const updateBookingWindowBodySchema = z.object({
  action: z.enum(ACTIONS),
  /** open: when booking opens (null = now). Ignored for extend and close. */
  opens_at: isoDateTime().nullable(),
  /** open and extend: when booking closes. Ignored for close. */
  closes_at: isoDateTime().nullable(),
  note: z.string().trim().max(NOTE_MAX_LENGTH).nullable(),
});
export type UpdateBookingWindowBody = z.infer<typeof updateBookingWindowBodySchema>;

/** Where the window stands at `now`. */
export function windowStatusAt(
  opensAt: number | null,
  closesAt: number | null,
  now: number,
): BookingWindowStatus {
  if (opensAt === null || closesAt === null || now < opensAt) return BookingWindowStatus.NotOpen;
  return now < closesAt ? BookingWindowStatus.Open : BookingWindowStatus.Closed;
}
