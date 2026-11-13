import { notGoingDatesOf } from "@/features/absences/mock-state";
import {
  CHECKOUT_REASON_TEXT,
  crewOutcomeFor,
  type MockCrewOutcome,
} from "@/features/crew/mock-state";
import { RiderState } from "@/features/crew/schema";
import {
  MOCK_CAMPUS_ARRIVAL,
  findMockLine,
  localized,
  toLineSummary,
} from "@/features/lines/mock-builders";
import { bookingOnDate } from "@/features/requests/mock-riding-line";
import { requireMockStudent } from "@/features/subscriptions/mock";
import { bookingOf } from "@/features/subscriptions/mock-state";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { TripDirection } from "@/features/trips/schema";
import {
  MS_PER_MINUTE,
  SERVICE_DAYS,
  addDays,
  cairoInstant,
  cairoOffsetOn,
  cairoNow,
  toMinutes,
} from "@/lib/api/mock/cairo-clock";
import { registerMock } from "@/lib/api/mock/mock-server";
import { getMyAttendanceEndpoint } from "./api";
import { TripOutcome, type AttendanceSummary, type TripRecord } from "./schema";

const DEFAULT_PAGE_SIZE = 20;
/** Mock only: about one day in twelve the student just doesn't show up. */
export const ABSENT_ONE_IN = 12;
/** Mock only: one day the student left the bus early, to show a check-out. */
const CHECKOUT_DAY_INDEX = 9;

/** A stable small number from a string, so the made-up history is the same on every load. */
export function hashOf(text: string): number {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

/**
 * Mock only: how many minutes off the timetable one trip ran. It belongs to the bus, not the
 * rider, so two riders on the same bus reach campus together, and riders at the same stop get
 * on together.
 */
export function tripShiftsOf(lineId: string, stopOrder: number, date: string) {
  return {
    boardShift: (hashOf(`${lineId}${stopOrder}${date}`) % 4) - 1,
    arriveShift: hashOf(`${lineId}${date}`) % 14,
  };
}

function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** Mock only: the made-up check-out reason. */
const MOCK_CHECKOUT_REASON = {
  ar: "تعبان، وولي الأمر استلمه من الطريق",
  en: "Felt unwell; picked up by guardian on the way",
} as const;

/**
 * Outbound trips from the moment the subscription started to today (today once the bus reached
 * campus). A trip that left before the subscription was approved is not in it: a student who
 * subscribed in the afternoon never "rode" that morning. Each day uses the line the student
 * rode that day (an approved line change moves it). Return trips join once the office
 * publishes return times.
 */
export function historyOf(userId: string, language: string, now: number): TripRecord[] {
  const booking = bookingOf(userId, now);
  if (!booking || booking.status !== SubscriptionStatus.Active || !booking.activatedAt) {
    return [];
  }
  const { activatedAt } = booking;
  const cairo = cairoNow(new Date(now));
  const notGoing = notGoingDatesOf(userId);
  const at = (date: string, clock: string, shift: number) =>
    new Date(cairoInstant(date, clock, cairoOffsetOn(date)) + shift * MS_PER_MINUTE).toISOString();

  const records: TripRecord[] = [];
  let date = cairoNow(new Date(activatedAt)).date;
  let index = 0;
  for (; date <= cairo.date; date = addDays(date, 1)) {
    const day = bookingOnDate(userId, date, now);
    const line = day && findMockLine(day.lineId);
    if (!day || !line) continue;
    const [pickup = "07:00", stopAr = "", stopEn = ""] = line.stops[day.stopOrder - 1] ?? [];
    const summary = toLineSummary(line, language);
    const crew = crewOutcomeFor(userId, line.lineId, date, now);
    if (crew) {
      // A trip the crew is still running has no record until it ends.
      if (crew.trip.endedAt !== null) {
        records.push(crewRecord(crew, { date, summary, language, stopAr, stopEn }));
        index += 1;
      }
      continue;
    }
    const departed = cairoInstant(date, pickup, cairoOffsetOn(date));
    const finished = date < cairo.date || cairo.minute >= toMinutes(MOCK_CAMPUS_ARRIVAL.to);
    if (!SERVICE_DAYS.has(weekdayOf(date)) || !finished || departed < activatedAt) continue;
    const seed = hashOf(`${userId}${date}`);
    let outcome: TripOutcome = TripOutcome.Rode;
    if (notGoing.has(date)) outcome = TripOutcome.NotGoing;
    else if (index === CHECKOUT_DAY_INDEX) outcome = TripOutcome.CheckedOut;
    else if (seed % ABSENT_ONE_IN === 0) outcome = TripOutcome.Absent;
    const { boardShift, arriveShift } = tripShiftsOf(line.lineId, day.stopOrder, date);
    const rides = outcome === TripOutcome.Rode || outcome === TripOutcome.CheckedOut;
    records.push({
      trip_id: `trp_${line.lineId}_${date}_out`,
      service_date: date,
      direction: TripDirection.Outbound,
      line: summary,
      stop_name: localized(language, stopAr, stopEn),
      outcome,
      boarded_at: rides ? at(date, pickup, boardShift) : null,
      arrived_at:
        outcome === TripOutcome.Rode ? at(date, MOCK_CAMPUS_ARRIVAL.from, arriveShift) : null,
      checked_out_at: outcome === TripOutcome.CheckedOut ? at(date, pickup, 25) : null,
      checkout_reason:
        outcome === TripOutcome.CheckedOut
          ? localized(language, MOCK_CHECKOUT_REASON.ar, MOCK_CHECKOUT_REASON.en)
          : null,
    });
    index += 1;
  }
  return records.reverse();
}

/** A trip the crew ran from the driver's page: its real scans decide the outcome. */
function crewRecord(
  { trip, rider }: MockCrewOutcome,
  context: {
    date: string;
    summary: TripRecord["line"];
    language: string;
    stopAr: string;
    stopEn: string;
  },
): TripRecord {
  const iso = (time: number | null) => (time === null ? null : new Date(time).toISOString());
  const outcome: Record<RiderState, TripOutcome> = {
    [RiderState.Boarded]: TripOutcome.Rode,
    [RiderState.CheckedOut]: TripOutcome.CheckedOut,
    [RiderState.NotGoing]: TripOutcome.NotGoing,
    [RiderState.Absent]: TripOutcome.Absent,
    [RiderState.Waiting]: TripOutcome.Absent,
  };
  const reason = rider.reason ? CHECKOUT_REASON_TEXT[rider.reason] : null;
  return {
    trip_id: trip.tripId,
    service_date: context.date,
    direction: TripDirection.Outbound,
    line: context.summary,
    stop_name: localized(context.language, context.stopAr, context.stopEn),
    outcome: outcome[rider.state],
    boarded_at: iso(rider.boardedAt),
    arrived_at: rider.state === RiderState.Boarded ? iso(trip.endedAt) : null,
    checked_out_at: iso(rider.checkedOutAt),
    checkout_reason: reason
      ? (rider.note ?? localized(context.language, reason.ar, reason.en))
      : null,
  };
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
