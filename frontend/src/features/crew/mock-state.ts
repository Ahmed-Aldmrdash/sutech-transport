import { MOCK_DESK_STUDENTS } from "@/features/subscriptions/mock-desk-students";
import { absencesOf } from "@/features/absences/mock-state";
import { isBlockedFromRiding } from "@/features/discipline/mock-state";
import type { AbsenceReason } from "@/features/absences/schema";
import { MOCK_ACCOUNTS, type MockAccount } from "@/features/auth/mock-accounts";
import { requireMockAccount } from "@/features/auth/mock-token";
import {
  MOCK_CAMPUS_ARRIVAL,
  MOCK_SEATS_BY_BUS,
  findMockLine,
} from "@/features/lines/mock-builders";
import { MOCK_LINES, type MockLineSource } from "@/features/lines/mock-lines";
import { bookingOnDate } from "@/features/requests/mock-riding-line";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { DEMO_TRIP_MS } from "@/features/tracking/demo-trip";
import { TripDirection } from "@/features/trips/schema";
import {
  MS_PER_MINUTE,
  SERVICE_DAYS,
  cairoInstant,
  cairoNow,
  cairoOffsetOn,
  toMinutes,
} from "@/lib/api/mock/cairo-clock";
import { ServerErrorCode } from "@/lib/api/errors";
import { MockHttpError } from "@/lib/api/mock/mock-server";
import { MockStorage, StoredMap } from "@/lib/api/mock/stored-map";
import { todayInCairo } from "@/lib/format";
import {
  lineBusId,
  lineDriverId,
  mockFleetBus,
  mockFleetDriver,
  withFleet,
  type MockFleetBus,
  type MockFleetDriver,
} from "@/features/lines/mock-fleet";
import type { ReplacementReason } from "@/features/emergencies/schema";
import { TEST_DAY_KEY, isTestDay } from "./test-day";
import { Role } from "@/lib/auth/roles";
import {
  CrewErrorCode,
  CrewTripStatus,
  RiderState,
  ScanMethod,
  type CheckoutReason,
  type DelayReason,
} from "./schema";

/**
 * The mock server's memory of the crew's trips: when each started and ended, every scan, the
 * delays and the SOS alerts. The student's tracking, "My trips" and the guardian's day read it
 * too, so a scan on the driver's phone shows up on theirs, as it would with the real server.
 */

/**
 * Who each crew account is in the Abu El Hol fleet. A driver is one of the fleet's drivers:
 * DRV-1001 drives line 7's own bus (Seif's), DRV-1002 is a spare driver at the garage with no
 * line of his own until the office sends him to one. The supervisor rides line 7's bus.
 */
const MOCK_CREW_DRIVERS: Readonly<Record<string, string>> = {
  usr_driver_1: "drv_ln_07",
  usr_driver_2: "drv_spare_4",
};
const MOCK_CREW_SUPERVISOR_LINES: Readonly<Record<string, string>> = {
  usr_supervisor_1: "ln_07",
};

/** The fleet driver behind a driver account, if any. */
export function crewDriverIdOf(userId: string): string | null {
  return MOCK_CREW_DRIVERS[userId] ?? null;
}

/** The supervisor accounts riding a line. */
export function supervisorIdsOf(lineId: string): string[] {
  return Object.entries(MOCK_CREW_SUPERVISOR_LINES)
    .filter(([, id]) => id === lineId)
    .map(([userId]) => userId);
}

const CREW_ROLES: readonly Role[] = [Role.Driver, Role.Supervisor];

/** A start this close to the timetable runs at real speed; any other time is a short test trip. */
const ON_TIME_WINDOW_MINUTES = 30;
const MIN_TRIP_MINUTES = 10;

/** Mock only: one subscriber in twelve doesn't show up, one in fifteen reported "not going". */
const FILLER_ABSENT_ONE_IN = 12;
const FILLER_NOT_GOING_ONE_IN = 15;

export interface MockScan {
  boardedAt: number;
  method: ScanMethod;
  checkedOutAt: number | null;
  reason: CheckoutReason | null;
  note: string | null;
}

export interface MockDelay {
  delayId: string;
  minutes: number;
  reason: DelayReason;
  note: string | null;
  reportedAt: number;
}

export interface MockCrewTrip {
  tripId: string;
  lineId: string;
  date: string;
  direction: TripDirection;
  startedAt: number | null;
  endedAt: number | null;
  scans: Record<string, MockScan>;
  delays: MockDelay[];
  sosIds: string[];
  /** The office sent another bus or driver. Oldest first; the last one is the trip's crew now. */
  replacements?: MockReplacement[];
  /** Which crew account pressed start and end (driver or supervisor). */
  startedBy?: string | null;
  endedBy?: string | null;
}

export interface MockReplacement {
  replacementId: string;
  busId: string;
  driverId: string;
  reason: ReplacementReason;
  note: string | null;
  sosId: string | null;
  by: string;
  at: number;
}

const trips = new StoredMap<MockCrewTrip>("sut.mock.crewTrips", MockStorage.Local);

export function isMockServiceDay(date: string, weekday: number): boolean {
  return SERVICE_DAYS.has(weekday) || isTestDay(date);
}

function tripIdOf(lineId: string, date: string, direction: TripDirection): string {
  return `trp_${lineId}_${date}_${direction === TripDirection.Outbound ? "out" : "ret"}`;
}

/** The stored trip, or a fresh not-started one. */
export function crewTripOf(lineId: string, date: string, direction: TripDirection): MockCrewTrip {
  const tripId = tripIdOf(lineId, date, direction);
  return (
    trips.get(tripId) ?? {
      tripId,
      lineId,
      date,
      direction,
      startedAt: null,
      endedAt: null,
      scans: {},
      delays: [],
      sosIds: [],
    }
  );
}

export function saveCrewTrip(trip: MockCrewTrip): void {
  trips.set(trip.tripId, trip);
}

export function findCrewTrip(tripId: string): MockCrewTrip | undefined {
  const match = /^trp_(.+)_(\d{4}-\d{2}-\d{2})_(out|ret)$/.exec(tripId);
  if (!match) return undefined;
  const [, lineId = "", date = "", kind] = match;
  if (!findMockLine(lineId)) return undefined;
  return crewTripOf(lineId, date, kind === "out" ? TripDirection.Outbound : TripDirection.Return);
}

/** The bus and driver running the trip now: the line's own, or the last ones the office sent. */
export function crewFleetOf(
  trip: MockCrewTrip,
  line: MockLineSource,
): { bus: MockFleetBus; driver: MockFleetDriver } {
  // A change made on the morning trip carries on to the return trip that day.
  const last =
    trip.replacements?.at(-1) ??
    (trip.direction === TripDirection.Return
      ? trips.get(tripIdOf(trip.lineId, trip.date, TripDirection.Outbound))?.replacements?.at(-1)
      : undefined);
  const bus = mockFleetBus(last?.busId ?? lineBusId(line.lineId));
  const driver = mockFleetDriver(last?.driverId ?? lineDriverId(line.lineId));
  if (!bus || !driver) throw new Error(`No fleet for ${trip.tripId}`);
  return { bus, driver };
}

/** Every trip stored for a day, on any line. */
export function crewTripsOn(date: string): MockCrewTrip[] {
  return [...trips.values()].filter((trip) => trip.date === date);
}

/**
 * The bus and driver on the line today: if the office changed the bus or the driver on
 * today's trip, the new ones. Students, guardians and the crew all see this.
 */
export function todayFleetOf(
  line: MockLineSource,
  now: number,
): { bus: MockFleetBus; driver: MockFleetDriver } {
  return fleetOnDate(line, cairoNow(new Date(now)).date);
}

/**
 * The bus and driver on the line on one day. A replacement belongs to its own day's trip, so
 * tomorrow's trip shows the line's usual bus again.
 */
function fleetOnDate(
  line: MockLineSource,
  date: string,
): { bus: MockFleetBus; driver: MockFleetDriver } {
  const replaced = [TripDirection.Outbound, TripDirection.Return]
    .map((direction) => trips.get(tripIdOf(line.lineId, date, direction)))
    .filter((trip): trip is MockCrewTrip => Boolean(trip?.replacements?.length))
    .sort((a, b) => (a.replacements?.at(-1)?.at ?? 0) - (b.replacements?.at(-1)?.at ?? 0))
    .at(-1);
  return crewFleetOf(replaced ?? crewTripOf(line.lineId, date, TripDirection.Outbound), line);
}

/** The line as students and guardians should see it today (see todayFleetOf). */
export function todayLineSource(line: MockLineSource, now: number): MockLineSource {
  return lineSourceOn(line, cairoNow(new Date(now)).date);
}

/** The line as it runs on `date`: that day's bus and driver. */
export function lineSourceOn(line: MockLineSource, date: string): MockLineSource {
  const { bus, driver } = fleetOnDate(line, date);
  return withFleet(line, bus, driver);
}

/** Every bus or driver change the office made, for the line notices. */
export function allReplacements(): { lineId: string; replacement: MockReplacement }[] {
  return [...trips.values()].flatMap((trip) =>
    (trip.replacements ?? []).map((replacement) => ({ lineId: trip.lineId, replacement })),
  );
}

export function crewTripStatus(trip: MockCrewTrip): CrewTripStatus {
  if (trip.endedAt !== null) return CrewTripStatus.Ended;
  if (trip.startedAt !== null) return CrewTripStatus.InProgress;
  return CrewTripStatus.NotStarted;
}

/** When the bus leaves its first stop and reaches campus on the timetable. */
function scheduleOf(line: MockLineSource, date: string) {
  const offset = cairoOffsetOn(date);
  const first = line.stops[0]?.[0] ?? "07:00";
  return {
    leavesAt: cairoInstant(date, first, offset),
    arrivesAt: cairoInstant(date, MOCK_CAMPUS_ARRIVAL.from, offset),
  };
}

/**
 * How long the trip takes. Started near the timetable: the real timetable. Any other time
 * (an evening try-out): a short test trip, like the tracking page's demo trip.
 */
function crewTripClock(trip: MockCrewTrip, line: MockLineSource) {
  const startsAt = trip.startedAt ?? Date.now();
  const { leavesAt, arrivesAt } = scheduleOf(line, trip.date);
  const window = ON_TIME_WINDOW_MINUTES * MS_PER_MINUTE;
  const onTime =
    trip.direction === TripDirection.Outbound &&
    startsAt >= leavesAt - window &&
    startsAt <= arrivesAt;
  const ends = onTime
    ? Math.max(arrivesAt, startsAt + MIN_TRIP_MINUTES * MS_PER_MINUTE)
    : startsAt + DEMO_TRIP_MS;
  return { startsAt, arrivesAt: ends };
}

/** Share of the trip done (0 to 1); a trip that ended counts as done at its end. */
export function crewProgress(trip: MockCrewTrip, line: MockLineSource, now: number): number {
  if (trip.startedAt === null) return 0;
  const { startsAt, arrivesAt } = crewTripClock(trip, line);
  const at = trip.endedAt ?? now;
  return Math.min(1, Math.max(0, (at - startsAt) / (arrivesAt - startsAt)));
}

/** Where along the outbound trip a stop is (0 to 1), by its pickup time. */
function stopShare(line: MockLineSource, stopOrder: number): number {
  const first = toMinutes(line.stops[0]?.[0] ?? "07:00");
  const arrival = toMinutes(MOCK_CAMPUS_ARRIVAL.from);
  const pickup = toMinutes(line.stops[stopOrder - 1]?.[0] ?? "07:00");
  return (pickup - first) / Math.max(1, arrival - first);
}

// ---------------------------------------------------------------------------------------------
// Riders

const FIRST_NAMES: readonly (readonly [string, string])[] = [
  ["يوسف", "Youssef"],
  ["مريم", "Mariam"],
  ["عبد الرحمن", "Abdelrahman"],
  ["سلمى", "Salma"],
  ["كريم", "Karim"],
  ["نور", "Nour"],
  ["زياد", "Ziad"],
  ["هنا", "Hana"],
  ["مازن", "Mazen"],
  ["فرح", "Farah"],
  ["إياد", "Eyad"],
  ["جنى", "Jana"],
  ["سيف", "Seif"],
  ["رنا", "Rana"],
  ["حمزة", "Hamza"],
  ["ملك", "Malak"],
  ["أدهم", "Adham"],
  ["ياسمين", "Yasmin"],
  ["مصطفى", "Mostafa"],
  ["حبيبة", "Habiba"],
  ["عمرو", "Amr"],
  ["لجين", "Logain"],
  ["خالد", "Khaled"],
  ["شهد", "Shahd"],
];

/** Father's names and family names, mixed so ~700 riders rarely share a full name. */
const FATHER_NAMES: readonly (readonly [string, string])[] = [
  ["محمود", "Mahmoud"],
  ["أحمد", "Ahmed"],
  ["حسن", "Hassan"],
  ["إبراهيم", "Ibrahim"],
  ["طارق", "Tarek"],
  ["عادل", "Adel"],
  ["سامي", "Samy"],
  ["وليد", "Walid"],
  ["أشرف", "Ashraf"],
  ["هشام", "Hesham"],
  ["جمال", "Gamal"],
  ["ممدوح", "Mamdouh"],
  ["رأفت", "Raafat"],
  ["شريف", "Sherif"],
  ["عاطف", "Atef"],
  ["مجدي", "Magdy"],
  ["عمر", "Omar"],
  ["ياسر", "Yasser"],
  ["هاني", "Hany"],
  ["تامر", "Tamer"],
];

const FAMILY_NAMES: readonly (readonly [string, string])[] = [
  ["السيد", "El Sayed"],
  ["عبد العزيز", "Abdelaziz"],
  ["مصطفى", "Mostafa"],
  ["فاروق", "Farouk"],
  ["سليمان", "Soliman"],
  ["منصور", "Mansour"],
  ["الشربيني", "El Sherbiny"],
  ["عثمان", "Osman"],
  ["النجار", "El Naggar"],
  ["بدوي", "Badawy"],
  ["رضوان", "Radwan"],
  ["زكي", "Zaki"],
  ["حمدي", "Hamdy"],
  ["لطفي", "Lotfy"],
  ["يونس", "Younes"],
  ["الحسيني", "El Husseiny"],
  ["عبد الله", "Abdallah"],
  ["الشافعي", "El Shafei"],
  ["قاسم", "Kassem"],
  ["الجندي", "El Gendy"],
];

const NOT_GOING_FILLER_REASONS: readonly AbsenceReason[] = ["sick", "no_lectures", "personal"];

export interface MockRider {
  studentId: string;
  nameAr: string;
  nameEn: string;
  identifier: string;
  stopOrder: number;
  /** A real demo account (scanned by the crew), not a made-up seat filler. */
  isAccount: boolean;
}

function hashOf(text: string): number {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

/**
 * Everyone subscribed on the line. Ahmed: every bus is full, so the demo accounts with an
 * active booking on it are joined by made-up students up to the bus's seats (less the few
 * seats some lines still offer).
 */
export function mockRidersOf(line: MockLineSource, date = todayInCairo()): MockRider[] {
  const riders: MockRider[] = [];
  for (const { user } of MOCK_ACCOUNTS) {
    if (user.role !== Role.Student) continue;
    // The line they ride that day: an approved temporary change puts them on this roster.
    const booking = bookingOnDate(user.id, date);
    if (booking?.lineId !== line.lineId || booking.status !== SubscriptionStatus.Active) continue;
    riders.push({
      studentId: user.id,
      nameAr: user.name_ar ?? user.name,
      nameEn: user.name,
      identifier: user.identifier,
      stopOrder: booking.stopOrder,
      isAccount: true,
    });
  }
  // The made-up students the offices work with ride too, scanned like the seat fillers.
  for (const student of MOCK_DESK_STUDENTS) {
    const booking = bookingOnDate(student.id, date);
    if (booking?.lineId !== line.lineId || booking.status !== SubscriptionStatus.Active) continue;
    riders.push({
      studentId: student.id,
      nameAr: student.nameAr,
      nameEn: student.nameEn,
      identifier: student.identifier,
      stopOrder: booking.stopOrder,
      isAccount: false,
    });
  }
  // The seats the line still offers this term stay empty.
  const seats = MOCK_SEATS_BY_BUS[line.busType] - line.seatsAvailable;
  const stopCount = Math.max(1, line.stops.length);
  for (let seat = 0; riders.length < seats; seat += 1) {
    const seed = hashOf(`${line.lineId}-${seat}`);
    const [firstAr, firstEn] = FIRST_NAMES[seed % FIRST_NAMES.length] ?? ["", ""];
    const father = hashOf(`${line.lineId}-father-${seat}`);
    const [fatherAr, fatherEn] = FATHER_NAMES[father % FATHER_NAMES.length] ?? ["", ""];
    const family = hashOf(`${line.lineId}-family-${seat}`);
    const [familyAr, familyEn] = FAMILY_NAMES[family % FAMILY_NAMES.length] ?? ["", ""];
    riders.push({
      studentId: `usr_filler_${line.lineId}_${seat}`,
      nameAr: `${firstAr} ${fatherAr} ${familyAr}`,
      nameEn: `${firstEn} ${fatherEn} ${familyEn}`,
      identifier: `2${4 + (seed % 3)}01${String(10000 + (seed % 89999)).slice(-5)}`,
      stopOrder: 1 + (seat % stopCount),
      isAccount: false,
    });
  }
  return riders.sort((a, b) => a.stopOrder - b.stopOrder || a.nameEn.localeCompare(b.nameEn));
}

/** The rider's "not going" reason for the day, if they reported one. */
function notGoingReasonOf(rider: MockRider, date: string): AbsenceReason | null {
  if (rider.isAccount) {
    return absencesOf(rider.studentId).find((item) => item.serviceDate === date)?.reason ?? null;
  }
  const seed = hashOf(`${rider.studentId}${date}`);
  return seed % FILLER_NOT_GOING_ONE_IN === 1
    ? (NOT_GOING_FILLER_REASONS[seed % NOT_GOING_FILLER_REASONS.length] ?? "sick")
    : null;
}

export interface MockRiderState {
  state: RiderState;
  boardedAt: number | null;
  checkedOutAt: number | null;
  reason: CheckoutReason | null;
  note: string | null;
  method: ScanMethod | null;
  notGoing: AbsenceReason | null;
}

/**
 * Mock only: made-up students "get scanned" as the bus passes their stop (on the return trip,
 * at campus as it leaves), so the counts move during a demo. Demo accounts are only ever
 * boarded by a real scan from the crew's pages.
 */
function fillerScan(
  trip: MockCrewTrip,
  line: MockLineSource,
  rider: MockRider,
  now: number,
): MockScan | null {
  if (rider.isAccount || trip.startedAt === null) return null;
  if (notGoingReasonOf(rider, trip.date)) return null;
  if (isBlockedFromRiding(rider.studentId, trip.date)) return null;
  if (hashOf(`${rider.studentId}${trip.date}a`) % FILLER_ABSENT_ONE_IN === 0) return null;
  const share = trip.direction === TripDirection.Outbound ? stopShare(line, rider.stopOrder) : 0;
  if (crewProgress(trip, line, now) < share) return null;
  const { startsAt, arrivesAt } = crewTripClock(trip, line);
  return {
    boardedAt: Math.round(startsAt + share * (arrivesAt - startsAt)),
    method: ScanMethod.Qr,
    checkedOutAt: null,
    reason: null,
    note: null,
  };
}

export function riderStateOf(
  trip: MockCrewTrip,
  line: MockLineSource,
  rider: MockRider,
  now: number,
): MockRiderState {
  const notGoing = notGoingReasonOf(rider, trip.date);
  const scan = trip.scans[rider.studentId] ?? fillerScan(trip, line, rider, now);
  const base = { notGoing, boardedAt: null, checkedOutAt: null, reason: null, note: null };
  if (scan) {
    return {
      ...base,
      state: scan.checkedOutAt === null ? RiderState.Boarded : RiderState.CheckedOut,
      boardedAt: scan.boardedAt,
      checkedOutAt: scan.checkedOutAt,
      reason: scan.reason,
      note: scan.note,
      method: scan.method,
    };
  }
  if (notGoing) return { ...base, state: RiderState.NotGoing, method: null };
  // Suspended or banned: not on the bus, and never counted absent.
  if (isBlockedFromRiding(rider.studentId, trip.date)) {
    return { ...base, state: RiderState.Suspended, method: null };
  }
  if (trip.endedAt !== null) return { ...base, state: RiderState.Absent, method: null };
  return { ...base, state: RiderState.Waiting, method: null };
}

// ---------------------------------------------------------------------------------------------
// For the student's and the guardian's pages

/**
 * Today's outbound crew trip of a line, once the crew started it. The student's tracking,
 * "My trips" and the guardian's day follow it instead of the timetable.
 */
function startedOutboundTrip(lineId: string, date: string): MockCrewTrip | null {
  const trip = trips.get(tripIdOf(lineId, date, TripDirection.Outbound));
  return trip && trip.startedAt !== null ? trip : null;
}

export interface MockCrewOutcome {
  trip: MockCrewTrip;
  rider: MockRiderState;
}

/** What happened to one student on the line's outbound trip that day, if the crew ran it. */
export function crewOutcomeFor(studentId: string, lineId: string, date: string, now: number) {
  const trip = startedOutboundTrip(lineId, date);
  const line = findMockLine(lineId);
  if (!trip || !line) return null;
  const rider = mockRidersOf(line, date).find((item) => item.studentId === studentId);
  if (!rider) return null;
  return { trip, rider: riderStateOf(trip, line, rider, now) } satisfies MockCrewOutcome;
}

/** The instants the student's live map should follow, for a trip the crew started. */
export function crewLiveClock(lineId: string, now: number) {
  const date = cairoNow(new Date(now)).date;
  const trip = startedOutboundTrip(lineId, date);
  const line = findMockLine(lineId);
  if (!trip || !line) return null;
  return { date, ...crewTripClock(trip, line), endedAt: trip.endedAt };
}

/**
 * A line a demo crew account runs today: only the crew's own presses start and end its trips.
 * The supervisor's line, the demo drivers' own lines, and any line the office sent them to.
 */
function isDemoCrewLine(lineId: string, date: string): boolean {
  if (Object.values(MOCK_CREW_SUPERVISOR_LINES).includes(lineId)) return true;
  return Object.values(MOCK_CREW_DRIVERS).some(
    (driverId) => driverLineOn(driverId, date)?.lineId === lineId,
  );
}

interface MockOfficeTrip {
  trip: MockCrewTrip;
  /** Made up from the timetable (no crew pressed anything): demo accounts ride like the rest. */
  simulated: boolean;
}

/**
 * Mock only: a line's outbound trip as the offices see it. The demo crew's line follows the
 * crew's presses today; every other line (and the crew's line on earlier days) runs on its timetable (leaves its first stop, reaches
 * campus), so the office pages have a real-looking day to show. The real server only has
 * what the crews did.
 */
export function officeOutboundTrip(
  line: MockLineSource,
  date: string,
  now: number,
): MockOfficeTrip {
  const stored = crewTripOf(line.lineId, date, TripDirection.Outbound);
  // Today the demo crew's line waits for the crew; an earlier day it ran on its timetable.
  const crewDrivesIt = date === cairoNow(new Date(now)).date && isDemoCrewLine(line.lineId, date);
  if (stored.startedAt !== null || crewDrivesIt) {
    return { trip: stored, simulated: false };
  }
  const { leavesAt, arrivesAt } = scheduleOf(line, date);
  return {
    trip: {
      ...stored,
      startedAt: now >= leavesAt ? leavesAt : null,
      endedAt: now >= arrivesAt ? arrivesAt : null,
    },
    simulated: true,
  };
}

/** Test helper: forget every crew trip. */
export function resetCrewMock(): void {
  trips.clear();
  try {
    localStorage.removeItem(TEST_DAY_KEY);
  } catch {
    // Nothing to clear.
  }
}

// ---------------------------------------------------------------------------------------------
// Access, as the server checks it

const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;

/** The office's latest change on a line's trips that day, if any. */
function lastReplacementOn(lineId: string, date: string): MockReplacement | null {
  return (
    [TripDirection.Outbound, TripDirection.Return]
      .flatMap((direction) => trips.get(tripIdOf(lineId, date, direction))?.replacements ?? [])
      .sort((a, b) => a.at - b.at)
      .at(-1) ?? null
  );
}

/** The driver running a line that day: the office's latest choice, else the line's own. */
function lineDriverOn(lineId: string, date: string): string {
  return lastReplacementOn(lineId, date)?.driverId ?? lineDriverId(lineId);
}

/**
 * The line a fleet driver works that day: the line the office sent them to (the latest such
 * change), else their own line (even if they were relieved there, so they see what happened),
 * else none (a spare driver nobody sent anywhere).
 */
function driverLineOn(driverId: string, date: string): MockLineSource | null {
  const sentTo = MOCK_LINES.flatMap((line) => {
    const last = lastReplacementOn(line.lineId, date);
    return last && last.driverId === driverId && line.lineId !== homeLineIdOf(driverId)
      ? [{ line, at: last.at }]
      : [];
  })
    .sort((a, b) => a.at - b.at)
    .at(-1);
  if (sentTo) return sentTo.line;
  const home = homeLineIdOf(driverId);
  return home ? (findMockLine(home) ?? null) : null;
}

/** The line whose own driver this is, if any (a spare driver has none). */
export function homeLineIdOf(driverId: string): string | null {
  return MOCK_LINES.find((line) => lineDriverId(line.lineId) === driverId)?.lineId ?? null;
}

/** The office sent this driver to a line that isn't their own today. */
export function assignmentOf(driverId: string, date: string): MockReplacement | null {
  const line = driverLineOn(driverId, date);
  if (!line || line.lineId === homeLineIdOf(driverId)) return null;
  return lastReplacementOn(line.lineId, date);
}

/** The signed-in driver or supervisor and the line they work today, or 403 / 404. */
export function requireMockCrew(token: string | null) {
  const account = requireMockAccount(token);
  if (!CREW_ROLES.includes(account.user.role)) {
    throw new MockHttpError(HTTP_FORBIDDEN, ServerErrorCode.Forbidden, "Bus crew only.");
  }
  const driverId = crewDriverIdOf(account.user.id);
  const date = cairoNow(new Date()).date;
  const line = driverId
    ? driverLineOn(driverId, date)
    : findMockLine(MOCK_CREW_SUPERVISOR_LINES[account.user.id] ?? "");
  if (!line) {
    throw new MockHttpError(HTTP_NOT_FOUND, CrewErrorCode.NoAssignment, "Not on a bus today.");
  }
  return { account, line };
}

/**
 * The office's latest change of driver on today's trips of this line, if it took the bus away
 * from this driver account: they are relieved and can't run the trip any more (the supervisor
 * still can). A change of bus that keeps the same driver relieves nobody.
 */
export function relievedBy(
  account: MockAccount,
  line: MockLineSource,
  now: number,
): MockReplacement | null {
  const driverId = crewDriverIdOf(account.user.id);
  if (account.user.role !== Role.Driver || !driverId) return null;
  const date = cairoNow(new Date(now)).date;
  const last = lastReplacementOn(line.lineId, date);
  return last && lineDriverOn(line.lineId, date) !== driverId ? last : null;
}

/**
 * Line drivers the office took off their own line today: free to be sent to another line
 * (unless already sent somewhere).
 */
export function relievedLineDriverIds(date: string): string[] {
  return MOCK_LINES.filter(
    (line) => lineDriverOn(line.lineId, date) !== lineDriverId(line.lineId),
  ).map((line) => lineDriverId(line.lineId));
}

/** Like requireOwnTrip, for running it (start, scan, end, delay): a relieved driver can't. */
export function requireRunnableTrip(
  account: MockAccount,
  line: MockLineSource,
  tripId: string,
  now: number,
): MockCrewTrip {
  const trip = requireOwnTrip(line, tripId, now);
  if (relievedBy(account, line, now)) {
    throw new MockHttpError(
      HTTP_FORBIDDEN,
      CrewErrorCode.DriverRelieved,
      "The office handed this trip to another driver.",
    );
  }
  return trip;
}

/** Today's trip of the crew's own bus, or NOT_YOUR_TRIP like the server. */
export function requireOwnTrip(line: MockLineSource, tripId: string, now: number): MockCrewTrip {
  const trip = findCrewTrip(tripId);
  if (!trip || trip.lineId !== line.lineId || trip.date !== cairoNow(new Date(now)).date) {
    throw new MockHttpError(HTTP_FORBIDDEN, CrewErrorCode.NotYourTrip, "Not your bus's trip.");
  }
  return trip;
}

/** Every delay the crews reported, for the delay announcements on each line. */
export function allCrewDelays(): { lineId: string; delay: MockDelay }[] {
  return [...trips.values()].flatMap((trip) =>
    trip.delays.map((delay) => ({ lineId: trip.lineId, delay })),
  );
}

/** The check-out reason as the server words it for students and guardians. */
export const CHECKOUT_REASON_TEXT: Record<CheckoutReason, { ar: string; en: string }> = {
  unwell: { ar: "تعبان", en: "Felt unwell" },
  guardian_pickup: { ar: "ولي الأمر استلمه من الطريق", en: "Picked up by guardian on the way" },
  personal: { ar: "ظرف شخصي", en: "Personal reason" },
  other: { ar: "سبب تاني", en: "Other reason" },
};
