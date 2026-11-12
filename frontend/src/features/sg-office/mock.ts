import { requireMockOffice } from "@/features/auth/mock-token";
import {
  CHECKOUT_REASON_TEXT,
  crewTripStatus,
  isMockServiceDay,
  lineSourceOn,
  mockRidersOf,
  officeOutboundTrip,
  riderStateOf,
  type MockRider,
} from "@/features/crew/mock-state";
import { CrewTripStatus, RiderState } from "@/features/crew/schema";
import { allMockEvents } from "@/features/event-buses/mock-state";
import { EventStatus } from "@/features/event-buses/schema";
import { localized, toLineSummary } from "@/features/lines/mock-builders";
import { MOCK_LINES, type MockLineSource } from "@/features/lines/mock-lines";
import { allSos, sosStatusOf } from "@/features/sos/mock-state";
import { mockStudentRecords } from "@/features/subscriptions/mock-desk-students";
import { violationStatusOf } from "@/features/violations/mock";
import { crewWithViolations, violationsOf } from "@/features/violations/mock-state";
import { ViolationStatus } from "@/features/violations/schema";
import { addDays, cairoNow } from "@/lib/api/mock/cairo-clock";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import { MockStorage, StoredMap } from "@/lib/api/mock/stored-map";
import { Role } from "@/lib/auth/roles";
import {
  getSgOverviewEndpoint,
  getWatchlistEndpoint,
  unwatchStudentEndpoint,
  watchStudentEndpoint,
} from "./api";
import {
  LineDayStatus,
  SG_DAYS_BACK_MAX,
  SgErrorCode,
  WATCHLIST_MAX,
  WatchedStatus,
  type SgLine,
  type SgOverview,
  type WatchedStudent,
  type Watchlist,
} from "./schema";

const HTTP = { NotFound: 404, Conflict: 409, Unprocessable: 422 };
const READERS = [Role.SecretaryGeneral];
/** Mock only: about one line in this many runs late on a timetable day. */
const DELAYED_LINE_ONE_IN = 8;
const MADE_UP_DELAY = { min: 10, spread: 16 };

const iso = (time: number) => new Date(time).toISOString();
const dateOf = (time: number) => cairoNow(new Date(time)).date;

function hashOf(text: string): number {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** Today, or a day up to a month back. */
function dayOf(date: string | undefined, now: number): string {
  const today = dateOf(now);
  const day = date ?? today;
  if (day > today || day < addDays(today, -SG_DAYS_BACK_MAX)) {
    throw new MockHttpError(
      HTTP.Unprocessable,
      SgErrorCode.DateInvalid,
      "Pick today or a day this past month.",
    );
  }
  return day;
}

/** The latest day before `date` with buses, within the month the page can show. */
function previousServiceDay(date: string, now: number): string | null {
  const oldest = addDays(dateOf(now), -SG_DAYS_BACK_MAX);
  for (let day = addDays(date, -1); day >= oldest; day = addDays(day, -1)) {
    if (isMockServiceDay(day, weekdayOf(day))) return day;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// A line's morning

interface LineMorning {
  line: MockLineSource;
  status: LineDayStatus;
  riders: { rider: MockRider; state: ReturnType<typeof riderStateOf> }[];
  delayMinutes: number | null;
}

function lineMorning(line: MockLineSource, date: string, now: number): LineMorning {
  if (!isMockServiceDay(date, weekdayOf(date))) {
    return { line, status: LineDayStatus.NoService, riders: [], delayMinutes: null };
  }
  const riders = mockRidersOf(line, date);
  const { trip, simulated } = officeOutboundTrip(line, date, now);
  const status = {
    [CrewTripStatus.NotStarted]: LineDayStatus.NotStarted,
    [CrewTripStatus.InProgress]: LineDayStatus.InProgress,
    [CrewTripStatus.Ended]: LineDayStatus.Ended,
  }[crewTripStatus(trip)];
  const states = riders.map((rider) => {
    // On a made-up timetable trip nobody scans for real, so the demo accounts ride like the rest.
    const asRider = simulated ? { ...rider, isAccount: false } : rider;
    return { rider, state: riderStateOf(trip, line, asRider, now) };
  });
  const seed = hashOf(`${line.lineId}${date}delay`);
  const madeUpDelay =
    simulated && trip.startedAt !== null && seed % DELAYED_LINE_ONE_IN === 0
      ? MADE_UP_DELAY.min + (seed % MADE_UP_DELAY.spread)
      : null;
  return {
    line,
    status,
    riders: states,
    delayMinutes: trip.delays.at(-1)?.minutes ?? madeUpDelay,
  };
}

function toSgLine(morning: LineMorning, date: string, language: string): SgLine {
  const { line, riders } = morning;
  const running = lineSourceOn(line, date);
  const counted = (states: RiderState[]) =>
    riders.filter(({ state }) => states.includes(state.state)).length;
  return {
    line: toLineSummary(line, language),
    bus: {
      plate: running.plate,
      bus_type: running.busType,
      driver_name: localized(language, running.driver.nameAr, running.driver.nameEn),
    },
    replaced: running.plate !== line.plate || running.driver.phone !== line.driver.phone,
    status: morning.status,
    subscribers: morning.status === LineDayStatus.NoService ? 0 : riders.length,
    rode: counted([RiderState.Boarded, RiderState.CheckedOut]),
    not_going: counted([RiderState.NotGoing]),
    absent: counted([RiderState.Absent]),
    delay_minutes: morning.delayMinutes,
  };
}

function overviewOf(date: string, now: number, language: string): SgOverview {
  const isServiceDay = isMockServiceDay(date, weekdayOf(date));
  const lines = MOCK_LINES.map((line) => toSgLine(lineMorning(line, date, now), date, language));
  const sum = (pick: (line: SgLine) => number) => lines.reduce((total, l) => total + pick(l), 0);
  const emergencies = allSos()
    .filter((sos) => dateOf(sos.createdAt) === date)
    .sort((a, b) => b.createdAt - a.createdAt)
    .flatMap((sos) => {
      const line = MOCK_LINES.find((item) => item.lineId === sos.lineId);
      return line
        ? [
            {
              sos_id: sos.id,
              type: sos.type,
              status: sosStatusOf(sos),
              line: toLineSummary(line, language),
              raised_at: iso(sos.createdAt),
            },
          ]
        : [];
    });
  const events = allMockEvents(now)
    .filter(
      (item) =>
        item.eventDate === date &&
        (item.status === EventStatus.WaitingCompany || item.status === EventStatus.Confirmed),
    )
    .sort((a, b) => a.departsAt.localeCompare(b.departsAt))
    .map((item) => ({
      event_id: item.eventId,
      reference: `EVT-${String(item.number).padStart(4, "0")}`,
      kind: item.kind,
      title: localized(language, item.title.ar, item.title.en),
      status: item.status,
      departs_at: item.departsAt,
      destination: localized(language, item.destination.ar, item.destination.en),
      students_count: item.studentsCount,
      buses: item.reply?.busIds.length ?? item.busesRequested,
    }));
  const violationsNew = crewWithViolations()
    .flatMap((crewId) => violationsOf(crewId))
    .filter((item) => violationStatusOf(item) === ViolationStatus.Submitted).length;
  return {
    date,
    is_today: date === dateOf(now),
    is_service_day: isServiceDay,
    previous_service_day: isServiceDay ? null : previousServiceDay(date, now),
    generated_at: iso(now),
    totals: {
      lines: lines.length,
      lines_running: lines.filter((line) => line.status === LineDayStatus.InProgress).length,
      lines_delayed: lines.filter((line) => line.delay_minutes !== null).length,
      subscribers: sum((line) => line.subscribers),
      rode: sum((line) => line.rode),
      not_going: sum((line) => line.not_going),
      absent: sum((line) => line.absent),
    },
    lines,
    emergencies,
    events,
    violations_new: violationsNew,
  };
}

// ---------------------------------------------------------------------------------------------
// The watch list

interface Watched {
  studentId: string;
  addedAt: number;
}

const watchlists = new StoredMap<Watched[]>("sut.mock.sgWatchlist", MockStorage.Local);

function watchlistOf(userId: string): Watched[] {
  return watchlists.get(userId) ?? [];
}

/** Where the student rides that day, if anywhere. */
function findRiding(studentId: string, date: string) {
  for (const line of MOCK_LINES) {
    const rider = mockRidersOf(line, date).find((item) => item.studentId === studentId);
    if (rider) return { line, rider };
  }
  return null;
}

/** A student by university ID: a rider on any line (made-up ones too) or a known student. */
function findStudentId(identifier: string, date: string): string | null {
  const known = mockStudentRecords().find((student) => student.identifier === identifier);
  if (known) return known.id;
  for (const line of MOCK_LINES) {
    const rider = mockRidersOf(line, date).find((item) => item.identifier === identifier);
    if (rider) return rider.studentId;
  }
  return null;
}

const WATCHED_OF: Record<RiderState, WatchedStatus> = {
  [RiderState.Waiting]: WatchedStatus.Waiting,
  [RiderState.Boarded]: WatchedStatus.OnBus,
  [RiderState.CheckedOut]: WatchedStatus.CheckedOut,
  [RiderState.NotGoing]: WatchedStatus.NotGoing,
  [RiderState.Absent]: WatchedStatus.Absent,
};

function toWatched(
  watched: Watched,
  date: string,
  now: number,
  language: string,
): WatchedStudent | null {
  const riding = findRiding(watched.studentId, date);
  const record = mockStudentRecords().find((student) => student.id === watched.studentId);
  const base = {
    boarded_at: null,
    checked_out_at: null,
    checkout_reason: null,
    added_at: iso(watched.addedAt),
  };
  if (!riding) {
    if (!record) return null;
    return {
      ...base,
      student: {
        student_id: record.id,
        identifier: record.identifier,
        name: localized(language, record.nameAr, record.nameEn),
        line: null,
        stop_name: null,
        pickup_time: null,
      },
      status: isMockServiceDay(date, weekdayOf(date))
        ? WatchedStatus.NoSubscription
        : WatchedStatus.NoService,
    };
  }
  const { line, rider } = riding;
  const [pickupTime = null, stopAr = "", stopEn = ""] = line.stops[rider.stopOrder - 1] ?? [];
  const student = {
    student_id: rider.studentId,
    identifier: rider.identifier,
    name: localized(language, rider.nameAr, rider.nameEn),
    line: toLineSummary(line, language),
    stop_name: localized(language, stopAr, stopEn),
    pickup_time: pickupTime,
  };
  const morning = lineMorning(line, date, now);
  const found = morning.riders.find((item) => item.rider.studentId === rider.studentId)?.state;
  if (morning.status === LineDayStatus.NoService || !found) {
    return { ...base, student, status: WatchedStatus.NoService };
  }
  const status =
    found.state === RiderState.Boarded && morning.status === LineDayStatus.Ended
      ? WatchedStatus.Arrived
      : WATCHED_OF[found.state];
  return {
    ...base,
    student,
    status,
    boarded_at: found.boardedAt === null ? null : iso(found.boardedAt),
    checked_out_at: found.checkedOutAt === null ? null : iso(found.checkedOutAt),
    checkout_reason: found.reason
      ? localized(
          language,
          CHECKOUT_REASON_TEXT[found.reason].ar,
          CHECKOUT_REASON_TEXT[found.reason].en,
        )
      : null,
  };
}

function watchlistFor(userId: string, date: string, now: number, language: string): Watchlist {
  return {
    date,
    items: [...watchlistOf(userId)]
      .sort((a, b) => b.addedAt - a.addedAt)
      .map((watched) => toWatched(watched, date, now, language))
      .filter((item): item is WatchedStudent => item !== null),
    max: WATCHLIST_MAX,
  };
}

// ---------------------------------------------------------------------------------------------

registerMock(getSgOverviewEndpoint, ({ query }, { token, language }) => {
  requireMockOffice(token, READERS);
  const now = Date.now();
  return overviewOf(dayOf(query.date, now), now, language);
});

registerMock(getWatchlistEndpoint, ({ query }, { token, language }) => {
  const { user } = requireMockOffice(token, READERS);
  const now = Date.now();
  return watchlistFor(user.id, dayOf(query.date, now), now, language);
});

registerMock(watchStudentEndpoint, ({ body }, { token, language }) => {
  const { user } = requireMockOffice(token, READERS);
  const now = Date.now();
  const today = dateOf(now);
  const studentId = findStudentId(body.identifier.trim(), today);
  if (!studentId) {
    throw new MockHttpError(HTTP.NotFound, SgErrorCode.StudentNotFound, "No such student.");
  }
  const list = watchlistOf(user.id);
  if (list.some((item) => item.studentId === studentId)) {
    throw new MockHttpError(HTTP.Conflict, SgErrorCode.AlreadyWatched, "Already followed.");
  }
  if (list.length >= WATCHLIST_MAX) {
    throw new MockHttpError(HTTP.Conflict, SgErrorCode.WatchlistFull, "The list is full.");
  }
  watchlists.set(user.id, [...list, { studentId, addedAt: now }]);
  return watchlistFor(user.id, today, now, language);
});

registerMock(unwatchStudentEndpoint, ({ params }, { token, language }) => {
  const { user } = requireMockOffice(token, READERS);
  const now = Date.now();
  watchlists.set(
    user.id,
    watchlistOf(user.id).filter((item) => item.studentId !== params.student_id),
  );
  return watchlistFor(user.id, dateOf(now), now, language);
});

/** Test helper: forget every watch list. */
export function resetSgMock(): void {
  watchlists.clear();
}
