import { bookingOf, type MockBooking } from "@/features/subscriptions/mock-state";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { requestsOf, type MockLineChangePayload } from "./mock-state";
import { statusAt } from "./mock-status";
import { LineChangeDuration, RequestKind, RequestStatus } from "./schema";

/**
 * The line a student actually rides on a given day, in the mock: their booking, moved by any
 * approved line change that covers that day. A temporary change counts only between its start
 * and end dates; a permanent one from its start date on. Every mock that shows a day's bus
 * (home, card, trips, rosters, tracking, the guardian's pages) reads the line from here, so an
 * approved change moves the student everywhere at once, and only for the right days.
 */
export function bookingOnDate(
  userId: string,
  date: string,
  now = Date.now(),
): MockBooking | undefined {
  const booking = bookingOf(userId, now);
  if (!booking || booking.status !== SubscriptionStatus.Active) return booking;
  const change = approvedChangeOn(userId, date, now);
  if (!change) return booking;
  return { ...booking, lineId: change.toLineId, stopOrder: change.toStopOrder };
}

/** The latest approved line change that covers `date`, if any. */
function approvedChangeOn(
  userId: string,
  date: string,
  now: number,
): MockLineChangePayload | undefined {
  let found: { at: number; payload: MockLineChangePayload } | undefined;
  for (const request of requestsOf(userId)) {
    const { payload } = request;
    if (payload.kind !== RequestKind.LineChange) continue;
    if (statusAt(request, now) !== RequestStatus.Approved) continue;
    if (!covers(payload, date)) continue;
    if (!found || request.submittedAt > found.at) found = { at: request.submittedAt, payload };
  }
  return found?.payload;
}

function covers(payload: MockLineChangePayload, date: string): boolean {
  if (date < payload.startsOn) return false;
  if (payload.duration === LineChangeDuration.Permanent) return true;
  return payload.endsOn === null || date <= payload.endsOn;
}
