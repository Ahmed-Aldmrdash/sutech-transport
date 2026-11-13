import { requireMockOffice } from "@/features/auth/mock-token";
import { mockGuardianAccountOf } from "@/features/children/mock-links";
import { countsOf, toRider } from "@/features/crew/mock";
import {
  crewProgress,
  crewTripStatus,
  isMockServiceDay,
  lineSourceOn,
  mockRidersOf,
  officeOutboundTrip,
  type MockRider,
} from "@/features/crew/mock-state";
import { RiderState } from "@/features/crew/schema";
import { fleetToday } from "@/features/event-buses/mock";
import { allMockEvents } from "@/features/event-buses/mock-state";
import { EventStatus } from "@/features/event-buses/schema";
import { MOCK_SEATS_BY_BUS, localized, toLineSummary } from "@/features/lines/mock-builders";
import { MOCK_LINES, type MockLineSource } from "@/features/lines/mock-lines";
import { newDeskCounts } from "@/features/request-desk/mock";
import { currentRequestsOf, officeActorOf } from "@/features/requests/mock";
import { statusAt } from "@/features/requests/mock-status";
import { bookingOnDate } from "@/features/requests/mock-riding-line";
import { RequestActor } from "@/features/requests/schema";
import { dayOf, lineMorning, overviewOf } from "@/features/sg-office/mock";
import { LineDayStatus } from "@/features/sg-office/schema";
import { allSos, sosStatusOf } from "@/features/sos/mock-state";
import { SosStatus } from "@/features/sos/schema";
import { findMockAccountById } from "@/features/auth/mock-accounts";
import {
  MOCK_DESK_STUDENTS,
  mockStudentRecords,
} from "@/features/subscriptions/mock-desk-students";
import { MOCK_TERM, seatsHeldOn } from "@/features/subscriptions/mock-state";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { MOCK_CAMPUS, mockPathOf } from "@/features/tracking/mock-geo";
import { pointAlong } from "@/features/tracking/geo";
import { addDays, cairoNow, toMinutes } from "@/lib/api/mock/cairo-clock";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import { Role } from "@/lib/auth/roles";
import {
  getLineAttendanceEndpoint,
  getLiveBusesEndpoint,
  getOpsFleetEndpoint,
  getOpsLineEndpoint,
  getOpsOverviewEndpoint,
  getOpsStudentEndpoint,
  listOpsLinesEndpoint,
  listOpsStudentsEndpoint,
} from "./api";
import {
  LiveBusStatus,
  OpsErrorCode,
  STUDENTS_PAGE_SIZE,
  type LiveBus,
  type OpsLine,
  type OpsStudent,
  type OpsStudentDetail,
} from "./schema";

const HTTP_NOT_FOUND = 404;
const TRANSPORT = [Role.Transport];
const GPS_LAG_MS = 3000;

const iso = (time: number) => new Date(time).toISOString();
const dateOf = (time: number) => cairoNow(new Date(time)).date;
const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

function requireLine(lineId: string): MockLineSource {
  const line = MOCK_LINES.find((item) => item.lineId === lineId);
  if (!line) throw new MockHttpError(HTTP_NOT_FOUND, OpsErrorCode.LineNotFound, "No such line.");
  return line;
}

/** Today's outbound trip id of a line, or null on a day without buses. */
function todayTripId(line: MockLineSource, now: number): string | null {
  const today = dateOf(now);
  if (!isMockServiceDay(today, weekdayOf(today))) return null;
  return officeOutboundTrip(line, today, now).trip.tripId;
}

// ---------------------------------------------------------------------------------------------
// Overview

registerMock(getOpsOverviewEndpoint, ({ query }, { token, language }) => {
  requireMockOffice(token, TRANSPORT);
  const now = Date.now();
  const desk = newDeskCounts(Role.Transport, now);
  return {
    ...overviewOf(dayOf(query.date, now), now, language),
    queues: {
      emergencies_open: allSos().filter((sos) => sosStatusOf(sos) !== SosStatus.Closed).length,
      requests_new: desk.requests,
      complaints_new: desk.complaints,
      events_waiting: allMockEvents(now).filter(
        (item) => item.status === EventStatus.WaitingCompany && item.eventDate > dateOf(now),
      ).length,
    },
  };
});

// ---------------------------------------------------------------------------------------------
// Live map

const LIVE_STATUS: Record<LineDayStatus, LiveBusStatus> = {
  [LineDayStatus.NoService]: LiveBusStatus.NoService,
  [LineDayStatus.NotStarted]: LiveBusStatus.NotStarted,
  [LineDayStatus.InProgress]: LiveBusStatus.OnTheRoad,
  [LineDayStatus.Ended]: LiveBusStatus.Arrived,
};

/** The last stop the bus passed, by pickup time along the trip. */
function nearStop(line: MockLineSource, progress: number, language: string): string | null {
  const first = toMinutes(line.stops[0]?.[0] ?? "07:00");
  const last = toMinutes(line.stops.at(-1)?.[0] ?? "08:00");
  const span = Math.max(1, last - first + 30);
  const passed = line.stops.filter(([time]) => (toMinutes(time) - first) / span <= progress);
  const stop = passed.at(-1);
  return progress > 0 && stop ? localized(language, stop[1], stop[2]) : null;
}

function liveBusOf(line: MockLineSource, now: number, language: string): LiveBus {
  const today = dateOf(now);
  const morning = lineMorning(line, today, now);
  const { trip } = officeOutboundTrip(line, today, now);
  const running = lineSourceOn(line, today);
  const onTheRoad = morning.status === LineDayStatus.InProgress;
  const progress = onTheRoad
    ? crewProgress(trip, line, now)
    : morning.status === LineDayStatus.Ended
      ? 1
      : 0;
  const { point, heading } = pointAlong(mockPathOf(line.lineId), progress);
  const rode = morning.riders.filter(
    ({ state }) => state.state === RiderState.Boarded || state.state === RiderState.CheckedOut,
  ).length;
  return {
    line: toLineSummary(line, language),
    trip_id: morning.status === LineDayStatus.NoService ? null : trip.tripId,
    bus: {
      plate: running.plate,
      bus_type: running.busType,
      driver_name: localized(language, running.driver.nameAr, running.driver.nameEn),
      driver_phone: running.driver.phone,
    },
    replaced: running.plate !== line.plate || running.driver.phone !== line.driver.phone,
    status: LIVE_STATUS[morning.status],
    position: onTheRoad
      ? {
          ...point,
          heading: Math.round(heading),
          speed_kmh: 40 + Math.round(Math.abs(Math.sin(now / 9000 + line.code.length)) * 20),
          recorded_at: iso(now - GPS_LAG_MS),
        }
      : null,
    near_stop: onTheRoad ? nearStop(line, progress, language) : null,
    progress,
    leaves_at: line.stops[0]?.[0] ?? null,
    subscribers: morning.status === LineDayStatus.NoService ? 0 : morning.riders.length,
    rode,
    delay_minutes: morning.delayMinutes,
    sos_open: allSos().some(
      (sos) => sos.tripId === trip.tripId && sosStatusOf(sos) !== SosStatus.Closed,
    ),
  };
}

registerMock(getLiveBusesEndpoint, (_input, { token, language }) => {
  requireMockOffice(token, TRANSPORT);
  const now = Date.now();
  return {
    generated_at: iso(now),
    campus_location: MOCK_CAMPUS,
    items: MOCK_LINES.map((line) => liveBusOf(line, now, language)),
  };
});

// ---------------------------------------------------------------------------------------------
// Lines

function toOpsLine(line: MockLineSource, language: string): OpsLine {
  const seats = MOCK_SEATS_BY_BUS[line.busType];
  const reserved = seatsHeldOn(line.lineId);
  const subscribers = mockRidersOf(line).length;
  return {
    line: toLineSummary(line, language),
    bus: {
      plate: line.plate,
      bus_type: line.busType,
      seats,
      driver_name: localized(language, line.driver.nameAr, line.driver.nameEn),
      driver_phone: line.driver.phone,
    },
    stops: line.stops.length,
    first_pickup: line.stops[0]?.[0] ?? null,
    subscribers,
    reserved,
    seats_free: Math.max(0, seats - subscribers - reserved),
  };
}

registerMock(listOpsLinesEndpoint, (_input, { token, language }) => {
  requireMockOffice(token, TRANSPORT);
  const items = MOCK_LINES.map((line) => toOpsLine(line, language));
  const sum = (pick: (line: OpsLine) => number) => items.reduce((total, l) => total + pick(l), 0);
  return {
    items,
    totals: {
      lines: items.length,
      seats: sum((line) => line.bus.seats),
      subscribers: sum((line) => line.subscribers),
      seats_free: sum((line) => line.seats_free),
    },
  };
});

registerMock(getOpsLineEndpoint, ({ params }, { token, language }) => {
  requireMockOffice(token, TRANSPORT);
  const now = Date.now();
  const line = requireLine(params.line_id);
  const riders = mockRidersOf(line);
  const stopOf = (order: number) => line.stops[order - 1];
  return {
    ...toOpsLine(line, language),
    stops_list: line.stops.map(([time, nameAr, nameEn], index) => ({
      order: index + 1,
      name: localized(language, nameAr, nameEn),
      pickup_time: time,
      subscribers: riders.filter((rider) => rider.stopOrder === index + 1).length,
    })),
    students: riders.map((rider) => ({
      student_id: rider.studentId,
      identifier: rider.identifier,
      name: localized(language, rider.nameAr, rider.nameEn),
      stop_order: rider.stopOrder,
      stop_name: localized(
        language,
        stopOf(rider.stopOrder)?.[1] ?? "",
        stopOf(rider.stopOrder)?.[2] ?? "",
      ),
      pickup_time: stopOf(rider.stopOrder)?.[0] ?? null,
    })),
    today_trip_id: todayTripId(line, now),
  };
});

// ---------------------------------------------------------------------------------------------
// Attendance

registerMock(getLineAttendanceEndpoint, ({ query }, { token, language }) => {
  requireMockOffice(token, TRANSPORT);
  const now = Date.now();
  const date = dayOf(query.date, now);
  const line = requireLine(query.line_id);
  const summary = toLineSummary(line, language);
  if (!isMockServiceDay(date, weekdayOf(date))) {
    return {
      date,
      line: summary,
      is_service_day: false,
      trip_status: null,
      counts: countsOf([]),
      riders: [],
    };
  }
  const { trip, simulated } = officeOutboundTrip(line, date, now);
  const riders = mockRidersOf(line, date).map((rider) =>
    // On a made-up timetable trip nobody scans for real, so the demo accounts ride like the rest.
    toRider(trip, line, simulated ? { ...rider, isAccount: false } : rider, language, now),
  );
  return {
    date,
    line: summary,
    is_service_day: true,
    trip_status: crewTripStatus(trip),
    counts: countsOf(riders),
    riders,
  };
});

// ---------------------------------------------------------------------------------------------
// Students

interface Seat {
  rider: MockRider;
  line: MockLineSource;
}

/** Every student riding a line today, by id. */
function seatsToday(): Map<string, Seat> {
  const seats = new Map<string, Seat>();
  for (const line of MOCK_LINES) {
    for (const rider of mockRidersOf(line)) seats.set(rider.studentId, { rider, line });
  }
  return seats;
}

function stopName(seat: Seat, language: string): string {
  const stop = seat.line.stops[seat.rider.stopOrder - 1];
  return stop ? localized(language, stop[1], stop[2]) : "";
}

/** Known students (with or without a seat) and every rider on the lines. */
function allStudents(language: string, now: number): OpsStudent[] {
  const seats = seatsToday();
  const today = dateOf(now);
  const known = mockStudentRecords().map((record): OpsStudent => {
    const seat = seats.get(record.id);
    const booking = bookingOnDate(record.id, today, now);
    return {
      student_id: record.id,
      identifier: record.identifier,
      name: localized(language, record.nameAr, record.nameEn),
      line: seat ? toLineSummary(seat.line, language) : null,
      stop_name: seat ? stopName(seat, language) : null,
      subscription_status: seat ? SubscriptionStatus.Active : (booking?.status ?? null),
    };
  });
  const knownIds = new Set(known.map((student) => student.student_id));
  const riders = [...seats.values()]
    .filter(({ rider }) => !knownIds.has(rider.studentId))
    .map((seat): OpsStudent => ({
      student_id: seat.rider.studentId,
      identifier: seat.rider.identifier,
      name: localized(language, seat.rider.nameAr, seat.rider.nameEn),
      line: toLineSummary(seat.line, language),
      stop_name: stopName(seat, language),
      subscription_status: SubscriptionStatus.Active,
    }));
  return [...known, ...riders];
}

function matches(student: OpsStudent, q: string | undefined): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return student.identifier.includes(needle) || student.name.toLowerCase().includes(needle);
}

registerMock(listOpsStudentsEndpoint, ({ query }, { token, language }) => {
  requireMockOffice(token, TRANSPORT);
  const page = query.page ?? 1;
  const found = allStudents(language, Date.now())
    .filter((student) => matches(student, query.q))
    .filter((student) => !query.line_id || student.line?.line_id === query.line_id)
    .sort((a, b) => a.name.localeCompare(b.name, language));
  return {
    items: found.slice((page - 1) * STUDENTS_PAGE_SIZE, page * STUDENTS_PAGE_SIZE),
    total: found.length,
    page,
    page_size: STUDENTS_PAGE_SIZE,
  };
});

/** This term's service days so far, before today. */
function termDaysSoFar(now: number): string[] {
  const days: string[] = [];
  const today = dateOf(now);
  // The office pages look a month back at most; the term summary does the same.
  const start = [MOCK_TERM.starts_on, addDays(today, -31)].sort().at(-1) ?? today;
  for (let day = start; day < today; day = addDays(day, 1)) {
    if (isMockServiceDay(day, weekdayOf(day))) days.push(day);
  }
  return days;
}

function tripsSoFar(seat: Seat | undefined, now: number) {
  const totals = { rode: 0, not_going: 0, absent: 0 };
  if (!seat) return totals;
  for (const day of termDaysSoFar(now)) {
    const state = lineMorning(seat.line, day, now).riders.find(
      (item) => item.rider.studentId === seat.rider.studentId,
    )?.state.state;
    if (state === RiderState.Boarded || state === RiderState.CheckedOut) totals.rode += 1;
    if (state === RiderState.NotGoing) totals.not_going += 1;
    if (state === RiderState.Absent) totals.absent += 1;
  }
  return totals;
}

/** The guardian on the student's file when no guardian account follows them. */
function deskGuardianOf(
  studentId: string,
): { ar: string; en: string; phone: string | null } | null {
  const desk = MOCK_DESK_STUDENTS.find((student) => student.id === studentId);
  if (desk) return { ar: desk.guardianNameAr, en: desk.guardianNameEn, phone: desk.guardianPhone };
  const user = findMockAccountById(studentId)?.user;
  if (!user?.guardian_name) return null;
  return { ar: user.guardian_name_ar ?? user.guardian_name, en: user.guardian_name, phone: null };
}

registerMock(getOpsStudentEndpoint, ({ params }, { token, language }) => {
  requireMockOffice(token, TRANSPORT);
  const now = Date.now();
  const student = allStudents(language, now).find((item) => item.student_id === params.student_id);
  if (!student) {
    throw new MockHttpError(HTTP_NOT_FOUND, OpsErrorCode.StudentNotFound, "No such student.");
  }
  const record = mockStudentRecords().find((item) => item.id === student.student_id);
  const seat = seatsToday().get(student.student_id);
  const guardianAccount = mockGuardianAccountOf(student.student_id);
  const desk = deskGuardianOf(student.student_id);
  const detail: OpsStudentDetail = {
    ...student,
    faculty: record
      ? localized(language, record.facultyAr ?? "", record.facultyEn ?? "") || null
      : null,
    level: record?.level ?? null,
    phone: record?.phone ?? null,
    pickup_time: seat ? (seat.line.stops[seat.rider.stopOrder - 1]?.[0] ?? null) : null,
    guardian: guardianAccount
      ? {
          name: localized(
            language,
            guardianAccount.user.name_ar ?? guardianAccount.user.name,
            guardianAccount.user.name,
          ),
          phone: guardianAccount.phone,
          has_account: true,
        }
      : desk
        ? { name: localized(language, desk.ar, desk.en), phone: desk.phone, has_account: false }
        : null,
    trips: tripsSoFar(seat, now),
    requests: currentRequestsOf(student.student_id, now)
      .sort((a, b) => b.submittedAt - a.submittedAt)
      .map((request) => ({
        request_id: request.requestId,
        reference: request.reference,
        kind: request.payload.kind,
        status: statusAt(request, now),
        received_at: iso(request.submittedAt),
        handled_here: officeActorOf(request.payload) !== RequestActor.Finance,
      })),
  };
  return detail;
});

// ---------------------------------------------------------------------------------------------
// Buses and drivers

registerMock(getOpsFleetEndpoint, (_input, { token, language }) => {
  requireMockOffice(token, TRANSPORT);
  const now = Date.now();
  return {
    ...fleetToday(now, language),
    trips: MOCK_LINES.flatMap((line) => {
      const tripId = todayTripId(line, now);
      return tripId ? [{ line_id: line.lineId, trip_id: tripId }] : [];
    }),
  };
});
