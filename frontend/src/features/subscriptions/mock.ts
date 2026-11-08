import { requireMockAccount } from "@/features/auth/mock-token";
import {
  findMockLine,
  localized,
  mockStopId,
  toLine,
  toLineSummary,
  MOCK_TERM_PRICE_PIASTERS,
} from "@/features/lines/mock-builders";
import { LineErrorCode } from "@/features/lines/schema";
import { ServerErrorCode } from "@/lib/api/errors";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import { Role } from "@/lib/auth/roles";
import {
  cancelSubscriptionEndpoint,
  createSubscriptionEndpoint,
  getMySubscriptionEndpoint,
} from "./api";
import {
  MOCK_HOLD_MS,
  MOCK_TERM,
  bookingOf,
  newMockId,
  paymentsOf,
  saveBooking,
  seatsHeldOn,
  type MockBooking,
} from "./mock-state";
import {
  BOOKABLE_STATUSES,
  SubscriptionErrorCode,
  SubscriptionStatus,
  type Subscription,
} from "./schema";

const HTTP = { Forbidden: 403, NotFound: 404, Conflict: 409, Unprocessable: 422 };

/** The signed-in student, or 403 for any other role (the server's role check). */
export function requireMockStudent(token: string | null) {
  const account = requireMockAccount(token);
  if (account.user.role !== Role.Student) {
    throw new MockHttpError(HTTP.Forbidden, ServerErrorCode.Forbidden, "Students only.");
  }
  return account;
}

export function mockTerm(language: string) {
  return {
    term_id: MOCK_TERM.term_id,
    name: localized(language, MOCK_TERM.nameAr, MOCK_TERM.nameEn),
    starts_on: MOCK_TERM.starts_on,
    ends_on: MOCK_TERM.ends_on,
  };
}

const iso = (time: number | null) => (time === null ? null : new Date(time).toISOString());

function toSubscription(userId: string, booking: MockBooking, language: string): Subscription {
  const line = findMockLine(booking.lineId);
  if (!line) throw new Error(`Unknown mock line ${booking.lineId}`);
  const [time, nameAr, nameEn] = line.stops[booking.stopOrder - 1] ?? [];
  const latest = paymentsOf(userId)
    .filter((payment) => payment.subscriptionId === booking.subscriptionId)
    .at(-1);
  return {
    subscription_id: booking.subscriptionId,
    status: booking.status,
    term: mockTerm(language),
    line: toLineSummary(line, language),
    stop: {
      stop_id: mockStopId(line.lineId, booking.stopOrder),
      name: localized(language, nameAr ?? "", nameEn ?? ""),
      pickup_time: time ?? null,
    },
    price_piasters: booking.pricePiasters,
    reserved_at: new Date(booking.reservedAt).toISOString(),
    hold_expires_at: iso(booking.holdExpiresAt),
    activated_at: iso(booking.activatedAt),
    latest_payment: latest
      ? {
          payment_id: latest.paymentId,
          status: latest.status,
          rejection_reason: latest.rejectionReason
            ? localized(language, latest.rejectionReason.ar, latest.rejectionReason.en)
            : null,
          submitted_at: new Date(latest.submittedAt).toISOString(),
        }
      : null,
  };
}

registerMock(getMySubscriptionEndpoint, (_input, { token, language }) => {
  const { user } = requireMockStudent(token);
  const booking = bookingOf(user.id);
  return { subscription: booking ? toSubscription(user.id, booking, language) : null };
});

registerMock(createSubscriptionEndpoint, ({ body }, { token, language }) => {
  const { user } = requireMockStudent(token);
  const current = bookingOf(user.id);
  if (current && !BOOKABLE_STATUSES.includes(current.status)) {
    throw new MockHttpError(
      HTTP.Conflict,
      SubscriptionErrorCode.AlreadySubscribed,
      "You already have a booking this term.",
    );
  }
  const line = findMockLine(body.line_id);
  if (!line) throw new MockHttpError(HTTP.NotFound, LineErrorCode.LineNotFound, "No such line.");
  const stopOrder = line.stops.findIndex(
    (_stop, index) => mockStopId(line.lineId, index + 1) === body.stop_id,
  );
  if (stopOrder < 0) {
    throw new MockHttpError(
      HTTP.Unprocessable,
      SubscriptionErrorCode.StopNotOnLine,
      "That stop isn't on this line.",
    );
  }
  if (toLine(line, language, seatsHeldOn(line.lineId)).seats_available <= 0) {
    throw new MockHttpError(
      HTTP.Conflict,
      SubscriptionErrorCode.SeatUnavailable,
      "No seats left on this line.",
    );
  }
  const now = Date.now();
  const booking: MockBooking = {
    subscriptionId: newMockId("sub"),
    lineId: line.lineId,
    stopOrder: stopOrder + 1,
    status: SubscriptionStatus.Reserved,
    pricePiasters: MOCK_TERM_PRICE_PIASTERS,
    reservedAt: now,
    holdExpiresAt: now + MOCK_HOLD_MS,
    activatedAt: null,
  };
  saveBooking(user.id, booking);
  return toSubscription(user.id, booking, language);
});

registerMock(cancelSubscriptionEndpoint, ({ params }, { token, language }) => {
  const { user } = requireMockStudent(token);
  const booking = bookingOf(user.id);
  if (!booking || booking.subscriptionId !== params.subscription_id) {
    throw new MockHttpError(HTTP.NotFound, ServerErrorCode.NotFound, "No such booking.");
  }
  if (booking.status !== SubscriptionStatus.Reserved) {
    throw new MockHttpError(
      HTTP.Conflict,
      SubscriptionErrorCode.NotCancellable,
      "Only an unpaid reservation can be cancelled.",
    );
  }
  const cancelled = { ...booking, status: SubscriptionStatus.Cancelled, holdExpiresAt: null };
  saveBooking(user.id, cancelled);
  return toSubscription(user.id, cancelled, language);
});
