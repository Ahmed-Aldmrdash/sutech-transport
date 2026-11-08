import { absencesOf } from "@/features/absences/mock-state";
import type { AbsenceReason } from "@/features/absences/schema";
import { MOCK_ACCOUNTS } from "@/features/auth/mock-accounts";
import { requireMockAccount } from "@/features/auth/mock-token";
import {
  MOCK_CAMPUS_ARRIVAL,
  MOCK_SEATS_BY_BUS,
  findMockLine,
} from "@/features/lines/mock-builders";
import type { MockLineSource } from "@/features/lines/mock-lines";
import { bookingOf } from "@/features/subscriptions/mock-state";
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

/** Which bus each crew account runs. Both demo accounts are on line 7, Seif's bus. */
const MOCK_CREW_LINES: Readonly<Record<string, string>> = {
  usr_driver_1: "ln_07",
  usr_supervisor_1: "ln_07",
};

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
  const last = trip.replacements?.at(-1);
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
  const date = cairoNow(new Date(now)).date;
  const replaced = [TripDirection.Outbound, TripDirection.Return]
    .map((direction) => trips.get(tripIdOf(line.lineId, date, direction)))
    .filter((trip): trip is MockCrewTrip => Boolean(trip?.replacements?.length))
    .sort((a, b) => (a.replacements?.at(-1)?.at ?? 0) - (b.replacements?.at(-1)?.at ?? 0))
    .at(-1);
  return crewFleetOf(replaced ?? crewTripOf(line.lineId, date, TripDirection.Outbound), line);
}

/** The line as students and guardians should see it today (see todayFleetOf). */
export function todayLineSource(line: MockLineSource, now: number): MockLineSource {
  const { bus, driver } = todayFleetOf(line, now);
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

const FAMILY_NAMES: readonly (readonly [string, string])[] = [
  ["محمود السيد", "Mahmoud El Sayed"],
  ["أحمد عبد العزيز", "Ahmed Abdelaziz"],
  ["حسن مصطفى", "Hassan Mostafa"],
  ["إبراهيم فاروق", "Ibrahim Farouk"],
  ["طارق سليمان", "Tarek Soliman"],
  ["عادل منصور", "Adel Mansour"],
  ["سامي الشربيني", "Samy El Sherbiny"],
  ["وليد عثمان", "Walid Osman"],
  ["أشرف النجار", "Ashraf El Naggar"],
  ["هشام بدوي", "Hesham Badawy"],
  ["جمال رضوان", "Gamal Radwan"],
  ["ممدوح زكي", "Mamdouh Zaki"],
  ["رأفت حمدي", "Raafat Hamdy"],
  ["شريف لطفي", "Sherif Lotfy"],
  ["عاطف يونس", "Atef Younes"],
  ["مجدي الحسيني", "Magdy El Husseiny"],
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
 * active booking on it are joined by made-up students up to the bus's seats.
 */
export function mockRidersOf(line: MockLineSource): MockRider[] {
  const riders: MockRider[] = [];
  for (const { user } of MOCK_ACCOUNTS) {
    if (user.role !== Role.Student) continue;
    const booking = bookingOf(user.id);
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
  const seats = MOCK_SEATS_BY_BUS[line.busType];
  const stopCount = Math.max(1, line.stops.length);
  for (let seat = 0; riders.length < seats; seat += 1) {
    const seed = hashOf(`${line.lineId}-${seat}`);
    const [firstAr, firstEn] = FIRST_NAMES[seed % FIRST_NAMES.length] ?? ["", ""];
    const family = hashOf(`${line.lineId}-family-${seat}`);
    const [familyAr, familyEn] = FAMILY_NAMES[family % FAMILY_NAMES.length] ?? ["", ""];
    riders.push({
      studentId: `usr_filler_${line.lineId}_${seat}`,
      nameAr: `${firstAr} ${familyAr}`,
      nameEn: `${firstEn} ${familyEn}`,
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
  const rider = mockRidersOf(line).find((item) => item.studentId === studentId);
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

/** The signed-in driver or supervisor and their line, or the server's 403 / 404. */
export function requireMockCrew(token: string | null) {
  const account = requireMockAccount(token);
  if (!CREW_ROLES.includes(account.user.role)) {
    throw new MockHttpError(HTTP_FORBIDDEN, ServerErrorCode.Forbidden, "Bus crew only.");
  }
  const line = findMockLine(MOCK_CREW_LINES[account.user.id] ?? "");
  if (!line) {
    throw new MockHttpError(HTTP_NOT_FOUND, CrewErrorCode.NoAssignment, "Not on a bus today.");
  }
  return { account, line };
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
