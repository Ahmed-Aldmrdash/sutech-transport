import { recordAudit } from "@/features/admin-system/mock-log";
import { AuditAction } from "@/features/admin-system/schema";
import { findMockAccountById } from "@/features/auth/mock-accounts";
import { requireMockAccount, requireMockOffice } from "@/features/auth/mock-token";
import { localized } from "@/features/lines/mock-builders";
import { MOCK_TERM } from "@/features/subscriptions/mock-state";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import { Role, isRiderRole } from "@/lib/auth/roles";
import { formatDateTime } from "@/lib/format";
import { getBookingWindowEndpoint, updateBookingWindowEndpoint } from "./api";
import { bookingWindowOf, saveBookingWindow, type MockBookingWindow } from "./mock-state";
import {
  BookingWindowAction,
  BookingWindowErrorCode,
  BookingWindowStatus,
  windowStatusAt,
  type BookingWindow,
} from "./schema";

const HTTP = { Conflict: 409, Unprocessable: 422 };
const BOOKING_OFFICES = [Role.Transport];

const iso = (time: number | null) => (time === null ? null : new Date(time).toISOString());

function toWindow(
  window: MockBookingWindow,
  language: string,
  withHistory: boolean,
  now: number,
): BookingWindow {
  return {
    term_name: localized(language, MOCK_TERM.nameAr, MOCK_TERM.nameEn),
    status: windowStatusAt(window.opensAt, window.closesAt, now),
    opens_at: iso(window.opensAt),
    closes_at: iso(window.closesAt),
    history: withHistory
      ? [...window.history]
          .sort((a, b) => b.at - a.at)
          .map((change) => {
            const user = findMockAccountById(change.byId)?.user;
            return {
              action: change.action,
              opens_at: iso(change.opensAt),
              closes_at: iso(change.closesAt),
              note: change.note,
              by_name: user ? localized(language, user.name_ar ?? user.name, user.name) : "",
              at: new Date(change.at).toISOString(),
            };
          })
      : [],
  };
}

function invalid(code: string, message: string): never {
  throw new MockHttpError(HTTP.Unprocessable, code, message);
}

registerMock(getBookingWindowEndpoint, (_input, { token, language }) => {
  const account = requireMockAccount(token);
  const isRider = isRiderRole(account.user.role);
  if (!isRider) requireMockOffice(token, BOOKING_OFFICES);
  const now = Date.now();
  return toWindow(bookingWindowOf(now), language, !isRider, now);
});

registerMock(updateBookingWindowEndpoint, ({ body }, { token, language }) => {
  const actor = requireMockOffice(token, BOOKING_OFFICES);
  const now = Date.now();
  const current = bookingWindowOf(now);
  const status = windowStatusAt(current.opensAt, current.closesAt, now);
  let next: MockBookingWindow;
  let audit: AuditAction;

  if (body.action === BookingWindowAction.Open) {
    const opensAt = body.opens_at ? Date.parse(body.opens_at) : now;
    const closesAt = body.closes_at ? Date.parse(body.closes_at) : null;
    if (closesAt === null || closesAt <= now || closesAt <= opensAt) {
      invalid(BookingWindowErrorCode.InvalidWindow, "Close after it opens, in the future.");
    }
    next = { ...current, opensAt, closesAt };
    audit = AuditAction.BookingOpened;
  } else if (body.action === BookingWindowAction.Extend) {
    if (current.opensAt === null || current.closesAt === null) {
      throw new MockHttpError(HTTP.Conflict, BookingWindowErrorCode.NeverOpened, "Open first.");
    }
    const closesAt = body.closes_at ? Date.parse(body.closes_at) : null;
    if (closesAt === null || closesAt <= now) {
      invalid(BookingWindowErrorCode.InvalidWindow, "The new end must be in the future.");
    }
    if (closesAt <= current.closesAt) {
      invalid(BookingWindowErrorCode.ExtendMustBeLater, "Pick a later end.");
    }
    // A window that never started yet keeps its opening; a closed one opens again now.
    const opensAt =
      status === BookingWindowStatus.Closed ? Math.min(current.opensAt, now) : current.opensAt;
    next = { ...current, opensAt, closesAt };
    audit = AuditAction.BookingExtended;
  } else {
    if (current.opensAt === null || current.closesAt === null) {
      throw new MockHttpError(HTTP.Conflict, BookingWindowErrorCode.NeverOpened, "Not open.");
    }
    if (status === BookingWindowStatus.Closed) {
      throw new MockHttpError(HTTP.Conflict, BookingWindowErrorCode.AlreadyClosed, "Closed.");
    }
    // Closing a window that hasn't opened yet cancels it.
    next =
      status === BookingWindowStatus.NotOpen
        ? { ...current, opensAt: null, closesAt: null }
        : { ...current, closesAt: now };
    audit = AuditAction.BookingClosed;
  }

  const note = body.note?.trim() || null;
  saveBookingWindow({
    ...next,
    history: [
      ...current.history,
      {
        action: body.action,
        opensAt: next.opensAt,
        closesAt: next.closesAt,
        note,
        byId: actor.user.id,
        at: now,
      },
    ],
  });
  const until = next.closesAt
    ? {
        ar: `حتى ${formatDateTime(new Date(next.closesAt).toISOString(), "ar")}`,
        en: `Until ${formatDateTime(new Date(next.closesAt).toISOString(), "en")}`,
      }
    : { ar: "الحجز مقفول", en: "Booking closed" };
  recordAudit(
    actor,
    audit,
    { ar: `الحجز · ${MOCK_TERM.nameAr}`, en: `Booking · ${MOCK_TERM.nameEn}` },
    note ? { ar: `${until.ar} · ${note}`, en: `${until.en} · ${note}` } : until,
  );
  return toWindow(bookingWindowOf(now), language, true, now);
});
