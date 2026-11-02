import { notGoingDatesOf } from "@/features/absences/mock-state";
import {
  MOCK_CAMPUS_ARRIVAL,
  findMockLine,
  localized,
  toLineSummary,
} from "@/features/lines/mock-builders";
import { requireMockStudent } from "@/features/subscriptions/mock";
import { bookingOf } from "@/features/subscriptions/mock-state";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { TripDirection } from "@/features/trips/schema";
import {
  MS_PER_MINUTE,
  SERVICE_DAYS,
  addDays,
  cairoInstant,
  cairoNow,
  toMinutes,
} from "@/lib/api/mock/cairo-clock";
import { registerMock } from "@/lib/api/mock/mock-server";
import { getMyAttendanceEndpoint } from "./api";
import { TripOutcome, type AttendanceSummary, type TripRecord } from "./schema";

const DEFAULT_PAGE_SIZE = 20;
/** Mock only: about one day in twelve the student just doesn't show up. */
const ABSENT_ONE_IN = 12;
/** Mock only: one day the student left the bus early, to show a check-out. */
const CHECKOUT_DAY_INDEX = 9;

/** A stable small number from a string, so the made-up history is the same on every load. */
function hashOf(text: string): number {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/**
 * Outbound trips from the day the subscription started to today (today once the bus reached
 * campus). Return trips join once the office publishes return times.
 */
function historyOf(userId: string, language: string, now: number): TripRecord[] {
  const booking = bookingOf(userId, now);
  const line = booking && findMockLine(booking.lineId);
  if (!booking || !line || booking.status !== SubscriptionStatus.Active || !booking.activatedAt) {
    return [];
  }
  const cairo = cairoNow(new Date(now));
  const [pickup = "07:00", stopAr = "", stopEn = ""] = line.stops[booking.stopOrder - 1] ?? [];
  const notGoing = notGoingDatesOf(userId);
  const summary = toLineSummary(line, language);
  const at = (date: string, clock: string, shift: number) =>
    new Date(cairoInstant(date, clock, cairo.offsetMinutes) + shift * MS_PER_MINUTE).toISOString();

  const records: TripRecord[] = [];
  let date = cairoNow(new Date(booking.activatedAt)).date;
  let index = 0;
  while (date <= cairo.date) {
    const finished = date < cairo.date || cairo.minute >= toMinutes(MOCK_CAMPUS_ARRIVAL.to);
    if (SERVICE_DAYS.has(weekdayOf(date)) && finished) {
      const seed = hashOf(`${userId}${date}`);
      let outcome: TripOutcome = TripOutcome.Rode;
      if (notGoing.has(date)) outcome = TripOutcome.NotGoing;
      else if (index === CHECKOUT_DAY_INDEX) outcome = TripOutcome.CheckedOut;
      else if (seed % ABSENT_ONE_IN === 0) outcome = TripOutcome.Absent;
      const rides = outcome === TripOutcome.Rode || outcome === TripOutcome.CheckedOut;
      records.push({
        trip_id: `trp_${line.lineId}_${date}_out`,
        service_date: date,
        direction: TripDirection.Outbound,
        line: summary,
        stop_name: localized(language, stopAr, stopEn),
        outcome,
        boarded_at: rides ? at(date, pickup, (seed % 4) - 1) : null,
        arrived_at:
          outcome === TripOutcome.Rode ? at(date, MOCK_CAMPUS_ARRIVAL.from, seed % 14) : null,
        checked_out_at: outcome === TripOutcome.CheckedOut ? at(date, pickup, 25) : null,
        checkout_reason:
          outcome === TripOutcome.CheckedOut
            ? localized(
                language,
                "تعبان، وولي الأمر استلمه من الطريق",
                "Felt unwell; picked up by guardian on the way",
              )
            : null,
      });
      index += 1;
    }
    date = addDays(date, 1);
  }
  return records.reverse();
}

function summarize(records: readonly TripRecord[]): AttendanceSummary {
  const count = (outcome: TripOutcome) => records.filter((item) => item.outcome === outcome).length;
  return {
    rode: count(TripOutcome.Rode),
    absent: count(TripOutcome.Absent),
    not_going: count(TripOutcome.NotGoing),
    checked_out: count(TripOutcome.CheckedOut),
  };
}

registerMock(getMyAttendanceEndpoint, ({ query }, { token, language }) => {
  const { user } = requireMockStudent(token);
  const all = historyOf(user.id, language, Date.now());
  const listed = query.outcome ? all.filter((item) => item.outcome === query.outcome) : all;
  const page = query.page ?? 1;
  const pageSize = query.page_size ?? DEFAULT_PAGE_SIZE;
  return {
    items: listed.slice((page - 1) * pageSize, page * pageSize),
    total: listed.length,
    summary: summarize(all),
  };
});
