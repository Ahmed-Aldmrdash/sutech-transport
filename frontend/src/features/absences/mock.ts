import { findMockLine } from "@/features/lines/mock-builders";
import { requireMockStudent } from "@/features/subscriptions/mock";
import { bookingOf, newMockId } from "@/features/subscriptions/mock-state";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { SERVICE_DAYS, addDays, cairoInstant, cairoNow } from "@/lib/api/mock/cairo-clock";
import { ServerErrorCode } from "@/lib/api/errors";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import { cancelAbsenceEndpoint, createAbsenceEndpoint, listMyAbsencesEndpoint } from "./api";
import { absencesOf, saveAbsences, type MockAbsence } from "./mock-state";
import {
  ABSENCE_DAYS_AHEAD,
  AbsenceErrorCode,
  type Absence,
  type MyAbsences,
  type ReportableDay,
} from "./schema";

const HTTP = { NotFound: 404, Conflict: 409, Unprocessable: 422 };

/** The student's line and the time its bus leaves the first stop. */
function activeLineOf(userId: string) {
  const booking = bookingOf(userId);
  const line = booking && findMockLine(booking.lineId);
  if (!booking || !line || booking.status !== SubscriptionStatus.Active) {
    throw new MockHttpError(
      HTTP.Conflict,
      AbsenceErrorCode.NoActiveSubscription,
      "Only active subscribers can report a day off.",
    );
  }
  return { line, firstDeparture: line.stops[0]?.[0] ?? "07:00" };
}

function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** Today (until the cutoff) and the service days up to a week ahead. */
function serviceDaysAhead(firstDeparture: string, now: number): ReportableDay[] {
  const cairo = cairoNow(new Date(now));
  const days: ReportableDay[] = [];
  for (let offset = 0; offset <= ABSENCE_DAYS_AHEAD; offset += 1) {
    const date = addDays(cairo.date, offset);
    if (!SERVICE_DAYS.has(weekdayOf(date))) continue;
    const cutoff = cairoInstant(date, firstDeparture, cairo.offsetMinutes);
    if (cutoff > now) days.push({ service_date: date, cutoff_at: new Date(cutoff).toISOString() });
  }
  return days;
}

function cutoffOf(date: string, firstDeparture: string, now: number): number {
  return cairoInstant(date, firstDeparture, cairoNow(new Date(now)).offsetMinutes);
}

function toAbsence(item: MockAbsence, firstDeparture: string, now: number): Absence {
  return {
    absence_id: item.absenceId,
    service_date: item.serviceDate,
    reason: item.reason,
    note: item.note,
    created_at: new Date(item.createdAt).toISOString(),
    cutoff_at: new Date(cutoffOf(item.serviceDate, firstDeparture, now)).toISOString(),
  };
}

function myAbsences(userId: string, firstDeparture: string): MyAbsences {
  const now = Date.now();
  const today = cairoNow(new Date(now)).date;
  const upcoming = absencesOf(userId)
    .filter((item) => item.serviceDate >= today)
    .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate));
  const reported = new Set(upcoming.map((item) => item.serviceDate));
  return {
    upcoming: upcoming.map((item) => toAbsence(item, firstDeparture, now)),
    reportable_days: serviceDaysAhead(firstDeparture, now).filter(
      (day) => !reported.has(day.service_date),
    ),
  };
}

registerMock(listMyAbsencesEndpoint, (_input, { token }) => {
  const { user } = requireMockStudent(token);
  return myAbsences(user.id, activeLineOf(user.id).firstDeparture);
});

registerMock(createAbsenceEndpoint, ({ body }, { token }) => {
  const { user } = requireMockStudent(token);
  const { firstDeparture } = activeLineOf(user.id);
  const now = Date.now();
  const list = absencesOf(user.id);
  if (list.some((item) => item.serviceDate === body.service_date)) {
    throw new MockHttpError(HTTP.Conflict, AbsenceErrorCode.AlreadyReported, "Already reported.");
  }
  const today = cairoNow(new Date(now)).date;
  const isToday = body.service_date === today;
  if (isToday && cutoffOf(today, firstDeparture, now) <= now) {
    throw new MockHttpError(
      HTTP.Conflict,
      AbsenceErrorCode.AbsenceCutoffPassed,
      "The bus already left.",
    );
  }
  const allowed = serviceDaysAhead(firstDeparture, now).some(
    (day) => day.service_date === body.service_date,
  );
  if (!allowed) {
    throw new MockHttpError(
      HTTP.Unprocessable,
      AbsenceErrorCode.DateNotReportable,
      "Pick a service day within the next week.",
    );
  }
  const created: MockAbsence = {
    absenceId: newMockId("abs"),
    serviceDate: body.service_date,
    reason: body.reason,
    note: body.note?.trim() || null,
    createdAt: now,
  };
  saveAbsences(user.id, [...list, created]);
  return toAbsence(created, firstDeparture, now);
});

registerMock(cancelAbsenceEndpoint, ({ params }, { token }) => {
  const { user } = requireMockStudent(token);
  const { firstDeparture } = activeLineOf(user.id);
  const now = Date.now();
  const list = absencesOf(user.id);
  const found = list.find((item) => item.absenceId === params.absence_id);
  if (!found) throw new MockHttpError(HTTP.NotFound, ServerErrorCode.NotFound, "No such report.");
  if (cutoffOf(found.serviceDate, firstDeparture, now) <= now) {
    throw new MockHttpError(
      HTTP.Conflict,
      AbsenceErrorCode.AbsenceCutoffPassed,
      "The bus already left; this day can't be changed.",
    );
  }
  saveAbsences(
    user.id,
    list.filter((item) => item !== found),
  );
  return myAbsences(user.id, firstDeparture);
});
