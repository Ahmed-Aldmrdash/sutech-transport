import { absencesOf } from "@/features/absences/mock-state";
import { AbsenceReason } from "@/features/absences/schema";
import { ABSENT_ONE_IN, hashOf, historyOf, tripShiftsOf } from "@/features/attendance/mock";
import {
  CHECKOUT_REASON_TEXT,
  crewOutcomeFor,
  isMockServiceDay,
  todayLineSource,
  type MockCrewOutcome,
} from "@/features/crew/mock-state";
import { RiderState } from "@/features/crew/schema";
import {
  MOCK_CAMPUS_ARRIVAL,
  findMockLine,
  localized,
  toBus,
  toLineSummary,
} from "@/features/lines/mock-builders";
import { bookingOnDate } from "@/features/requests/mock-riding-line";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { MS_PER_MINUTE, cairoInstant, cairoNow } from "@/lib/api/mock/cairo-clock";
import { registerMock } from "@/lib/api/mock/mock-server";
import { todayInCairo } from "@/lib/format";
import { getChildDayEndpoint, listChildrenEndpoint } from "./api";
import { mockChildrenOf, requireMockGuardian, requireMockGuardianOf } from "./mock-links";
import { ChildDayStatus, DayEventKind, type Child, type ChildDay, type DayEvent } from "./schema";

/** Days of history shown under today. */
const RECENT_DAYS = 5;
/** The supervisor marks no-shows absent when the bus reaches campus. */
const ABSENT_MARKED_AFTER_MINUTES = 0;

const REASON_TEXT: Record<AbsenceReason, { ar: string; en: string }> = {
  [AbsenceReason.Sick]: { ar: "تعبان", en: "Not feeling well" },
  [AbsenceReason.NoLectures]: { ar: "مفيش محاضرات", en: "No lectures today" },
  [AbsenceReason.Personal]: { ar: "ظرف شخصي", en: "Personal reason" },
  [AbsenceReason.Other]: { ar: "سبب تاني", en: "Other reason" },
};

/** Where the child is after each kind of event. */
const STATUS_AFTER: Record<DayEventKind, ChildDayStatus> = {
  [DayEventKind.NotGoing]: ChildDayStatus.NotGoing,
  [DayEventKind.BusLeft]: ChildDayStatus.BusOnWay,
  [DayEventKind.Boarded]: ChildDayStatus.Boarded,
  [DayEventKind.Arrived]: ChildDayStatus.Arrived,
  [DayEventKind.CheckedOut]: ChildDayStatus.CheckedOut,
  [DayEventKind.Absent]: ChildDayStatus.Absent,
};

type Step = { kind: DayEventKind; at: number; detail: string | null };

/** Same made-up outcome as the student's "My trips", so both pages agree. */
function timetableSteps(
  studentId: string,
  lineId: string,
  stopOrder: number,
  date: string,
  context: {
    at: (clock: string, shift?: number) => number;
    stopName: string;
    pickup: string;
    firstTime: string;
    firstStop: string;
  },
): Step[] {
  const { at, stopName, pickup, firstTime, firstStop } = context;
  const isAbsent = hashOf(`${studentId}${date}`) % ABSENT_ONE_IN === 0;
  const { boardShift, arriveShift } = tripShiftsOf(lineId, stopOrder, date);
  const steps: Step[] = [{ kind: DayEventKind.BusLeft, at: at(firstTime), detail: firstStop }];
  if (isAbsent) {
    steps.push({
      kind: DayEventKind.Absent,
      at: at(MOCK_CAMPUS_ARRIVAL.from, ABSENT_MARKED_AFTER_MINUTES),
      detail: null,
    });
  } else {
    steps.push(
      { kind: DayEventKind.Boarded, at: at(pickup, boardShift), detail: stopName },
      { kind: DayEventKind.Arrived, at: at(MOCK_CAMPUS_ARRIVAL.from, arriveShift), detail: null },
    );
  }
  return steps;
}

/** The trip the crew is running from the driver's page: its real start, scans and end. */
function crewSteps(
  { trip, rider }: MockCrewOutcome,
  context: { language: string; stopName: string; firstAr: string; firstEn: string },
): Step[] {
  const { language, stopName, firstAr, firstEn } = context;
  const steps: Step[] = [];
  if (trip.startedAt !== null) {
    steps.push({
      kind: DayEventKind.BusLeft,
      at: trip.startedAt,
      detail: localized(language, firstAr, firstEn),
    });
  }
  if (rider.boardedAt !== null) {
    steps.push({ kind: DayEventKind.Boarded, at: rider.boardedAt, detail: stopName });
  }
  if (rider.checkedOutAt !== null) {
    const reason = rider.reason ? CHECKOUT_REASON_TEXT[rider.reason] : null;
    steps.push({
      kind: DayEventKind.CheckedOut,
      at: rider.checkedOutAt,
      detail: rider.note ?? (reason ? localized(language, reason.ar, reason.en) : null),
    });
  }
  if (trip.endedAt !== null) {
    if (rider.state === RiderState.Boarded) {
      steps.push({ kind: DayEventKind.Arrived, at: trip.endedAt, detail: null });
    } else if (rider.state === RiderState.Absent) {
      steps.push({ kind: DayEventKind.Absent, at: trip.endedAt, detail: null });
    }
  }
  return steps;
}

export function mockChildDay(studentId: string, language: string, now: number): ChildDay {
  const cairo = cairoNow(new Date(now));
  const booking = bookingOnDate(studentId, cairo.date, now);
  const line = booking && findMockLine(booking.lineId);
  const base = { student_id: studentId, service_date: cairo.date };
  if (!booking || !line || booking.status !== SubscriptionStatus.Active) {
    return {
      ...base,
      status: ChildDayStatus.NoSubscription,
      trip: null,
      events: [],
      recent: [],
      days_off: [],
    };
  }

  const [pickup = "07:00", stopAr = "", stopEn = ""] = line.stops[booking.stopOrder - 1] ?? [];
  const [firstTime = "07:00", firstAr = "", firstEn = ""] = line.stops[0] ?? [];
  const stopName = localized(language, stopAr, stopEn);
  const trip = {
    line: toLineSummary(line, language),
    stop: { name: stopName, pickup_time: pickup },
    campus_arrival: MOCK_CAMPUS_ARRIVAL,
    bus: toBus(todayLineSource(line, now), language, true),
  };
  const recent = historyOf(studentId, language, now)
    .filter((record) => record.service_date < cairo.date)
    .slice(0, RECENT_DAYS);
  const days_off = absencesOf(studentId)
    .filter((item) => item.serviceDate >= cairo.date)
    .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate))
    .map((item) => ({
      service_date: item.serviceDate,
      reason: item.reason,
      note: item.note,
      reported_at: new Date(item.createdAt).toISOString(),
    }));
  const day = { ...base, trip, recent, days_off };

  // Subscribed after today's bus left: today has no trip for them yet, not a made-up ride.
  const subscribedAfterBusLeft =
    (booking.activatedAt ?? 0) > cairoInstant(cairo.date, firstTime, cairo.offsetMinutes);
  if (!isMockServiceDay(cairo.date, cairo.weekday) || subscribedAfterBusLeft) {
    return { ...day, status: ChildDayStatus.NoService, events: [] };
  }

  const absence = absencesOf(studentId).find((item) => item.serviceDate === cairo.date);
  if (absence) {
    const reason = REASON_TEXT[absence.reason];
    return {
      ...day,
      status: ChildDayStatus.NotGoing,
      events: [
        {
          kind: DayEventKind.NotGoing,
          at: new Date(absence.createdAt).toISOString(),
          detail: absence.note ?? localized(language, reason.ar, reason.en),
        },
      ],
    };
  }

  const at = (clock: string, shift = 0) =>
    cairoInstant(cairo.date, clock, cairo.offsetMinutes) + shift * MS_PER_MINUTE;
  const crew = crewOutcomeFor(studentId, line.lineId, cairo.date, now);
  const steps = crew
    ? crewSteps(crew, { language, stopName, firstAr, firstEn })
    : timetableSteps(studentId, line.lineId, booking.stopOrder, cairo.date, {
        at,
        stopName,
        pickup,
        firstTime,
        firstStop: localized(language, firstAr, firstEn),
      });
  const events: DayEvent[] = steps
    .filter((step) => step.at <= now)
    .map((step) => ({ kind: step.kind, at: new Date(step.at).toISOString(), detail: step.detail }));

  const last = events.at(-1);
  return { ...day, status: last ? STATUS_AFTER[last.kind] : ChildDayStatus.Waiting, events };
}

registerMock(listChildrenEndpoint, (_input, { token, language }) => {
  const guardian = requireMockGuardian(token);
  const children = mockChildrenOf(guardian.user.id).map(({ user }): Child => {
    const booking = bookingOnDate(user.id, todayInCairo());
    const line = booking && findMockLine(booking.lineId);
    const stop = line?.stops[(booking?.stopOrder ?? 1) - 1];
    return {
      student_id: user.id,
      name: localized(language, user.name_ar ?? user.name, user.name),
      identifier: user.identifier,
      faculty:
        localized(language, user.faculty_ar ?? user.faculty ?? "", user.faculty ?? "") || null,
      level: user.level ?? null,
      subscription:
        booking && line && stop
          ? {
              status: booking.status,
              line: toLineSummary(line, language),
              stop: { name: localized(language, stop[1], stop[2]), pickup_time: stop[0] },
            }
          : null,
    };
  });
  return { children };
});

registerMock(getChildDayEndpoint, ({ params }, { token, language }) => {
  const { child } = requireMockGuardianOf(token, params.student_id);
  return mockChildDay(child.user.id, language, Date.now());
});
