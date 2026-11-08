import {
  MOCK_CAMPUS_ARRIVAL,
  MOCK_SEATS_BY_BUS,
  localized,
  toLineSummary,
} from "@/features/lines/mock-builders";
import { mockFleetDriver } from "@/features/lines/mock-fleet";
import type { MockLineSource } from "@/features/lines/mock-lines";
import { findSos, sosStatusOf } from "@/features/sos/mock-state";
import { bookingOf, newMockId } from "@/features/subscriptions/mock-state";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { MOCK_ACCOUNTS, type MockAccount } from "@/features/auth/mock-accounts";
import { TripDirection } from "@/features/trips/schema";
import { cairoNow } from "@/lib/api/mock/cairo-clock";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import { Role } from "@/lib/auth/roles";
import {
  endTripEndpoint,
  getCrewTodayEndpoint,
  reportDelayEndpoint,
  scanEndpoint,
  startTripEndpoint,
} from "./api";
import { canReportDelay } from "./trip-rules";
import {
  crewTripOf,
  crewFleetOf,
  crewTripStatus,
  isMockServiceDay,
  mockRidersOf,
  requireMockCrew,
  requireRunnableTrip,
  relievedBy,
  riderStateOf,
  saveCrewTrip,
  todayFleetOf,
  type MockCrewTrip,
  type MockRider,
} from "./mock-state";
import {
  CrewErrorCode,
  CrewTripStatus,
  RiderState,
  ScanAction,
  ScanMethod,
  type CrewTrip,
  type Rider,
  type RiderCounts,
} from "./schema";

const HTTP = { NotFound: 404, Conflict: 409, Unprocessable: 422 };
/** A pass is accepted a few seconds past its 30-second life, for slow networks. */
const QR_GRACE_MS = 5000;
const MS_PER_SECOND = 1000;

function conflict(code: string, message: string): never {
  throw new MockHttpError(HTTP.Conflict, code, message);
}

function toRider(
  trip: MockCrewTrip,
  line: MockLineSource,
  rider: MockRider,
  language: string,
  now: number,
): Rider {
  const state = riderStateOf(trip, line, rider, now);
  const [pickup = null, stopAr = "", stopEn = ""] = line.stops[rider.stopOrder - 1] ?? [];
  const iso = (time: number | null) => (time === null ? null : new Date(time).toISOString());
  return {
    student_id: rider.studentId,
    name: localized(language, rider.nameAr, rider.nameEn),
    identifier: rider.identifier,
    stop_order: rider.stopOrder,
    stop_name: localized(language, stopAr, stopEn),
    pickup_time: trip.direction === TripDirection.Outbound ? pickup : null,
    state: state.state,
    boarded_at: iso(state.boardedAt),
    checked_out_at: iso(state.checkedOutAt),
    checkout_reason: state.reason,
    checkout_note: state.note,
    scan_method: state.method,
    not_going_reason: state.notGoing,
  };
}

function countsOf(riders: readonly Rider[]): RiderCounts {
  const count = (state: RiderState) => riders.filter((rider) => rider.state === state).length;
  return {
    total: riders.length,
    waiting: count(RiderState.Waiting),
    boarded: count(RiderState.Boarded),
    checked_out: count(RiderState.CheckedOut),
    not_going: count(RiderState.NotGoing),
    absent: count(RiderState.Absent),
  };
}

function replacementOf(trip: MockCrewTrip, line: MockLineSource, language: string) {
  const last = trip.replacements?.at(-1);
  if (!last) return null;
  const { bus, driver } = crewFleetOf(trip, line);
  return {
    bus_type: bus.busType,
    plate: bus.plate,
    driver_name: localized(language, driver.nameAr, driver.nameEn),
    driver_phone: driver.phone,
    at: new Date(last.at).toISOString(),
  };
}

/** Outbound trips leave at the first stop's pickup time; return times aren't published yet. */
function departureTimeOf(trip: MockCrewTrip, line: MockLineSource): string | null {
  return trip.direction === TripDirection.Outbound ? (line.stops[0]?.[0] ?? null) : null;
}

function toCrewTrip(
  trip: MockCrewTrip,
  line: MockLineSource,
  language: string,
  now: number,
): CrewTrip {
  const riders = mockRidersOf(line).map((rider) => toRider(trip, line, rider, language, now));
  const latestSos = trip.sosIds
    .map(findSos)
    .filter((sos) => sos !== undefined)
    .at(-1);
  const iso = (time: number | null) => (time === null ? null : new Date(time).toISOString());
  return {
    trip_id: trip.tripId,
    direction: trip.direction,
    status: crewTripStatus(trip),
    departure_time: departureTimeOf(trip, line),
    started_at: iso(trip.startedAt),
    ended_at: iso(trip.endedAt),
    riders,
    counts: countsOf(riders),
    delays: trip.delays.map((delay) => ({
      delay_id: delay.delayId,
      minutes: delay.minutes,
      reason: delay.reason,
      note: delay.note,
      reported_at: new Date(delay.reportedAt).toISOString(),
    })),
    replacement: replacementOf(trip, line, language),
    sos: latestSos
      ? {
          id: latestSos.id,
          type: latestSos.type,
          status: sosStatusOf(latestSos),
          created_at: new Date(latestSos.createdAt).toISOString(),
        }
      : null,
  };
}

/** Who took the bus over, for a relieved driver's trip page. */
function relievedNotice(account: MockAccount, line: MockLineSource, language: string, now: number) {
  const replacement = relievedBy(account, line, now);
  const driver = replacement ? mockFleetDriver(replacement.driverId) : undefined;
  if (!replacement || !driver) return null;
  return {
    driver_name: localized(language, driver.nameAr, driver.nameEn),
    driver_phone: driver.phone,
    at: new Date(replacement.at).toISOString(),
  };
}

registerMock(getCrewTodayEndpoint, (_input, { token, language }) => {
  const { account, line } = requireMockCrew(token);
  const now = Date.now();
  const cairo = cairoNow(new Date(now));
  const isServiceDay = isMockServiceDay(cairo.date, cairo.weekday);
  const directions = isServiceDay ? [TripDirection.Outbound, TripDirection.Return] : [];
  const fleet = todayFleetOf(line, now);
  return {
    service_date: cairo.date,
    is_service_day: isServiceDay,
    crew_role: account.user.role === Role.Supervisor ? Role.Supervisor : Role.Driver,
    line: toLineSummary(line, language),
    bus: {
      bus_id: fleet.bus.busId,
      bus_type: fleet.bus.busType,
      plate: fleet.bus.plate,
      seats: MOCK_SEATS_BY_BUS[fleet.bus.busType],
    },
    stops: line.stops.map(([time, nameAr, nameEn], index) => ({
      order: index + 1,
      name: localized(language, nameAr, nameEn),
      pickup_time: time,
    })),
    campus_arrival: MOCK_CAMPUS_ARRIVAL,
    relieved: relievedNotice(account, line, language, now),
    trips: directions.map((direction) =>
      toCrewTrip(crewTripOf(line.lineId, cairo.date, direction), line, language, now),
    ),
  };
});

registerMock(startTripEndpoint, ({ params }, { token, language }) => {
  const { account, line } = requireMockCrew(token);
  const now = Date.now();
  const trip = requireRunnableTrip(account, line, params.trip_id, now);
  const status = crewTripStatus(trip);
  if (status === CrewTripStatus.InProgress) {
    conflict(CrewErrorCode.TripAlreadyStarted, "The trip already started.");
  }
  if (status === CrewTripStatus.Ended) conflict(CrewErrorCode.TripAlreadyEnded, "Trip ended.");
  const other = crewTripOf(
    line.lineId,
    trip.date,
    trip.direction === TripDirection.Outbound ? TripDirection.Return : TripDirection.Outbound,
  );
  if (crewTripStatus(other) === CrewTripStatus.InProgress) {
    conflict(CrewErrorCode.OtherTripInProgress, "End the other trip first.");
  }
  const started = { ...trip, startedAt: now };
  saveCrewTrip(started);
  return toCrewTrip(started, line, language, now);
});

registerMock(endTripEndpoint, ({ params }, { token, language }) => {
  const { account, line } = requireMockCrew(token);
  const now = Date.now();
  const trip = requireRunnableTrip(account, line, params.trip_id, now);
  const status = crewTripStatus(trip);
  if (status === CrewTripStatus.NotStarted) {
    conflict(CrewErrorCode.TripNotStarted, "Start the trip first.");
  }
  if (status === CrewTripStatus.Ended) conflict(CrewErrorCode.TripAlreadyEnded, "Trip ended.");
  // Made-up riders who boarded on the way keep their scan once the trip is over.
  const scans = { ...trip.scans };
  for (const rider of mockRidersOf(line)) {
    const state = riderStateOf(trip, line, rider, now);
    if (!scans[rider.studentId] && state.boardedAt !== null && state.method !== null) {
      scans[rider.studentId] = {
        boardedAt: state.boardedAt,
        method: state.method,
        checkedOutAt: null,
        reason: null,
        note: null,
      };
    }
  }
  const ended = { ...trip, scans, endedAt: now };
  saveCrewTrip(ended);
  return toCrewTrip(ended, line, language, now);
});

/** The student a pass belongs to. Mock tokens look like SUT1.<payload>.<signature>. */
function studentFromQr(token: string, now: number): string {
  const [prefix, payload, signature] = token.split(".");
  let card: unknown;
  let exp: unknown;
  try {
    ({ card, exp } = JSON.parse(atob(payload ?? "")) as { card?: unknown; exp?: unknown });
  } catch {
    card = undefined;
  }
  if (prefix !== "SUT1" || !signature || typeof card !== "string" || typeof exp !== "number") {
    throw new MockHttpError(HTTP.Unprocessable, CrewErrorCode.CardInvalid, "Not a SUtech pass.");
  }
  if (exp * MS_PER_SECOND + QR_GRACE_MS < now) {
    throw new MockHttpError(HTTP.Unprocessable, CrewErrorCode.CardExpired, "Pass expired.");
  }
  const subscriptionId = card.replace(/^card_/, "");
  const owner = MOCK_ACCOUNTS.find(
    ({ user }) => bookingOf(user.id, now)?.subscriptionId === subscriptionId,
  );
  if (!owner) {
    throw new MockHttpError(HTTP.Unprocessable, CrewErrorCode.CardInvalid, "Unknown pass.");
  }
  return owner.user.id;
}

function studentFromIdentifier(identifier: string, riders: readonly MockRider[]): string {
  const typed = identifier.trim().toUpperCase();
  const rider = riders.find((item) => item.identifier === typed);
  if (rider) return rider.studentId;
  const account = MOCK_ACCOUNTS.find(
    ({ user }) => user.role === Role.Student && user.identifier === typed,
  );
  if (!account) {
    throw new MockHttpError(HTTP.NotFound, CrewErrorCode.StudentNotFound, "No such student.");
  }
  return account.user.id;
}

registerMock(scanEndpoint, ({ params, body }, { token, language }) => {
  const { account, line } = requireMockCrew(token);
  const now = Date.now();
  const trip = requireRunnableTrip(account, line, params.trip_id, now);
  const status = crewTripStatus(trip);
  if (status === CrewTripStatus.NotStarted) {
    conflict(CrewErrorCode.TripNotStarted, "Start the trip first.");
  }
  if (status === CrewTripStatus.Ended) conflict(CrewErrorCode.TripAlreadyEnded, "Trip ended.");

  const riders = mockRidersOf(line);
  const studentId =
    body.method === ScanMethod.Qr
      ? studentFromQr(body.qr_token ?? "", now)
      : studentFromIdentifier(body.identifier ?? "", riders);
  const rider = riders.find((item) => item.studentId === studentId);
  // Made-up seat fillers are subscribers by construction; demo accounts need a live booking.
  const subscribed =
    rider !== undefined &&
    (!rider.isAccount || bookingOf(studentId, now)?.status === SubscriptionStatus.Active);
  if (!rider || !subscribed) {
    conflict(CrewErrorCode.NotOnThisTrip, "Not a subscriber of this line.");
  }
  const current = riderStateOf(trip, line, rider, now);

  let scan = trip.scans[studentId];
  if (body.action === ScanAction.Board) {
    if (current.state === RiderState.Boarded) {
      conflict(CrewErrorCode.AlreadyBoarded, "Already on board.");
    }
    scan = { boardedAt: now, method: body.method, checkedOutAt: null, reason: null, note: null };
  } else {
    if (current.state !== RiderState.Boarded || current.boardedAt === null) {
      conflict(CrewErrorCode.NotOnBoard, "Not on board.");
    }
    if (!body.reason) {
      throw new MockHttpError(HTTP.Unprocessable, CrewErrorCode.ReasonRequired, "Reason?");
    }
    scan = {
      boardedAt: current.boardedAt,
      method: current.method ?? body.method,
      checkedOutAt: now,
      reason: body.reason,
      note: body.note ?? null,
    };
  }
  const updated = { ...trip, scans: { ...trip.scans, [studentId]: scan } };
  saveCrewTrip(updated);
  const view = toCrewTrip(updated, line, language, now);
  const result = view.riders.find((item) => item.student_id === studentId);
  if (!result) conflict(CrewErrorCode.NotOnThisTrip, "Not on this trip.");
  return { rider: result, counts: view.counts };
});

registerMock(reportDelayEndpoint, ({ params, body }, { token }) => {
  const { account, line } = requireMockCrew(token);
  const now = Date.now();
  const trip = requireRunnableTrip(account, line, params.trip_id, now);
  const status = crewTripStatus(trip);
  if (status === CrewTripStatus.Ended) conflict(CrewErrorCode.TripAlreadyEnded, "Trip ended.");
  if (!canReportDelay({ status, departure_time: departureTimeOf(trip, line) }, new Date(now))) {
    conflict(CrewErrorCode.DelayOutOfWindow, "Too far from the trip's time.");
  }
  const delay = {
    delayId: newMockId("dly"),
    minutes: body.minutes,
    reason: body.reason,
    note: body.note,
    reportedAt: now,
  };
  saveCrewTrip({ ...trip, delays: [...trip.delays, delay] });
  return {
    delay_id: delay.delayId,
    minutes: delay.minutes,
    reason: delay.reason,
    note: delay.note,
    reported_at: new Date(now).toISOString(),
  };
});
