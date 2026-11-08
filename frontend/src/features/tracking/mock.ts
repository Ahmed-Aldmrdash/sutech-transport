import type { MockAccount } from "@/features/auth/mock-accounts";
import { crewLiveClock, todayLineSource } from "@/features/crew/mock-state";
import { requireMockGuardianOf } from "@/features/children/mock-links";
import {
  MOCK_CAMPUS_ARRIVAL,
  findMockLine,
  localized,
  toBus,
  toLineSummary,
} from "@/features/lines/mock-builders";
import type { MockLineSource } from "@/features/lines/mock-lines";
import { requireMockStudent } from "@/features/subscriptions/mock";
import { bookingOnDate } from "@/features/requests/mock-riding-line";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { TripDirection, TripStatus } from "@/features/trips/schema";
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
import { getChildTrackingEndpoint, getMyTrackingEndpoint } from "./api";
import { DEMO_TRIP_MS, demoTripStartedAt } from "./demo-trip";
import { pathLengthKm, pathUntil, pointAlong } from "./geo";
import { MOCK_CAMPUS, mockPathOf } from "./mock-geo";
import { NoTrackingReason, type Tracking } from "./schema";

/** The bus's GPS starts reporting this long before it leaves the first stop. */
const WARM_UP_MINUTES = 5;
/** The trip shows as "arrived" this long after reaching campus. */
const ARRIVED_SHOW_MINUTES = 15;
const GPS_LAG_MS = 3000;
/** Speed wobble, so the number doesn't look frozen. */
const SPEED_WOBBLE_KMH = 6;

interface TripClock {
  date: string;
  /** Instant the bus leaves its first stop, and reaches campus. */
  startsAt: number;
  arrivesAt: number;
}

/** Today's trip if the bus is on the road now (or the test-mode demo trip), else null. */
function liveClock(line: MockLineSource, now: number): TripClock | null {
  const cairo = cairoNow(new Date(now));
  // Once the crew starts today's trip from the driver's page, the map follows that trip.
  const crew = crewLiveClock(line.lineId, now);
  if (crew) {
    const arrivesAt =
      crew.endedAt === null ? crew.arrivesAt : Math.min(crew.arrivesAt, crew.endedAt);
    const closesAt = arrivesAt + ARRIVED_SHOW_MINUTES * MS_PER_MINUTE;
    return now <= closesAt ? { date: crew.date, startsAt: crew.startsAt, arrivesAt } : null;
  }
  const demoStart = demoTripStartedAt(now);
  if (demoStart !== null) {
    return { date: cairo.date, startsAt: demoStart, arrivesAt: demoStart + DEMO_TRIP_MS };
  }
  if (!SERVICE_DAYS.has(cairo.weekday)) return null;
  const first = line.stops[0]?.[0] ?? "07:00";
  const startsAt = cairoInstant(cairo.date, first, cairo.offsetMinutes);
  const arrivesAt = cairoInstant(cairo.date, MOCK_CAMPUS_ARRIVAL.from, cairo.offsetMinutes);
  const opensAt = startsAt - WARM_UP_MINUTES * MS_PER_MINUTE;
  const closesAt = arrivesAt + ARRIVED_SHOW_MINUTES * MS_PER_MINUTE;
  return now >= opensAt && now <= closesAt ? { date: cairo.date, startsAt, arrivesAt } : null;
}

/** When the bus next leaves its first stop (today if not yet, else the next service day). */
function nextDeparture(line: MockLineSource, now: number): string {
  const cairo = cairoNow(new Date(now));
  const first = line.stops[0]?.[0] ?? "07:00";
  for (let offset = 0; offset <= 7; offset += 1) {
    const date = addDays(cairo.date, offset);
    const weekday = (cairo.weekday + offset) % 7;
    const at = cairoInstant(date, first, cairoOffsetOn(date));
    if (SERVICE_DAYS.has(weekday) && at > now) return new Date(at).toISOString();
  }
  return new Date(now).toISOString();
}

/** Share of the trip done (0 to 1) at a moment. */
function progressAt(clock: TripClock, at: number): number {
  return Math.min(1, Math.max(0, (at - clock.startsAt) / (clock.arrivesAt - clock.startsAt)));
}

/**
 * Where along the trip a stop is (0 to 1), by its pickup time. A demo trip runs the same
 * shape faster, so stops keep their place along it.
 */
function stopProgress(line: MockLineSource, stopOrder: number): number {
  const first = toMinutes(line.stops[0]?.[0] ?? "07:00");
  const arrival = toMinutes(MOCK_CAMPUS_ARRIVAL.from);
  const pickup = toMinutes(line.stops[stopOrder - 1]?.[0] ?? "07:00");
  return (pickup - first) / Math.max(1, arrival - first);
}

function mockTrackingFor(studentId: string, language: string, now: number): Tracking {
  const booking = bookingOnDate(studentId, cairoNow(new Date(now)).date, now);
  const line = booking && findMockLine(booking.lineId);
  if (!booking || !line || booking.status !== SubscriptionStatus.Active) {
    return { trip: null, reason: NoTrackingReason.NoSubscription, next_departure_at: null };
  }
  const clock = liveClock(line, now);
  if (!clock) {
    return {
      trip: null,
      reason: NoTrackingReason.NoTripNow,
      next_departure_at: nextDeparture(line, now),
    };
  }

  const path = mockPathOf(line.lineId);
  const done = progressAt(clock, now);
  const own = stopProgress(line, booking.stopOrder);
  // Minutes in "real trip" time, even when the demo plays faster.
  const realMinutes =
    toMinutes(MOCK_CAMPUS_ARRIVAL.from) - toMinutes(line.stops[0]?.[0] ?? "07:00");
  let status: TripStatus = TripStatus.Approaching;
  let eta: number | null = Math.round((own - done) * realMinutes);
  if (done >= 1) {
    status = TripStatus.Arrived;
    eta = null;
  } else if (done > own) {
    status = TripStatus.PassedStop;
    eta = Math.round((1 - done) * realMinutes);
  }

  const passed = line.stops.filter((_, index) => stopProgress(line, index + 1) <= done).at(-1);
  const { point, heading } = pointAlong(path, done);
  // Where the bus has been: along the roads, as its GPS fixes would draw it.
  const trail = pathUntil(path, done);

  const cruiseKmh = pathLengthKm(path) / (realMinutes / 60);
  const moving = done > 0 && done < 1;
  const speed = moving ? cruiseKmh + Math.sin(now / 7000) * SPEED_WOBBLE_KMH : 0;
  const [pickup = null, stopAr = "", stopEn = ""] = line.stops[booking.stopOrder - 1] ?? [];

  return {
    trip: {
      trip_id: `trp_${line.lineId}_${clock.date}_out`,
      service_date: clock.date,
      direction: TripDirection.Outbound,
      line: toLineSummary(line, language),
      bus: toBus(todayLineSource(line, now), language, true),
      stop: { name: localized(language, stopAr, stopEn), pickup_time: pickup },
      campus_arrival: MOCK_CAMPUS_ARRIVAL,
      status,
      eta_minutes: eta === null ? null : Math.max(0, eta),
      near_stop: passed ? localized(language, passed[1], passed[2]) : null,
      position: {
        ...point,
        heading: moving ? Math.round(heading) : null,
        speed_kmh: Math.max(0, Math.round(speed)),
        recorded_at: new Date(now - GPS_LAG_MS).toISOString(),
      },
      trail,
      stop_location: null,
      campus_location: MOCK_CAMPUS,
    },
    reason: null,
    next_departure_at: null,
  };
}

function trackingFor(student: MockAccount, language: string): Tracking {
  return mockTrackingFor(student.user.id, language, Date.now());
}

registerMock(getMyTrackingEndpoint, (_input, { token, language }) =>
  trackingFor(requireMockStudent(token), language),
);

registerMock(getChildTrackingEndpoint, ({ params }, { token, language }) =>
  trackingFor(requireMockGuardianOf(token, params.student_id).child, language),
);
