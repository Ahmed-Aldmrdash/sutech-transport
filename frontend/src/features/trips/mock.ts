import {
  MOCK_CAMPUS_ARRIVAL,
  findMockLine,
  localized,
  toLineSummary,
} from "@/features/lines/mock-builders";
import { requireMockStudent } from "@/features/subscriptions/mock";
import { bookingOf } from "@/features/subscriptions/mock-state";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { APP_TIME_ZONE } from "@/lib/format";
import { registerMock } from "@/lib/api/mock/mock-server";
import { getMyNextTripEndpoint } from "./api";
import { TripDirection, TripStatus, type NextTrip } from "./schema";

const MINUTES_PER_HOUR = 60;
const MS_PER_MINUTE = 60_000;
/** The bus counts as "on its way to you" this long before your pickup time. */
const APPROACH_WINDOW_MINUTES = 40;
/** Buses run Sunday to Thursday (0 = Sunday). */
const SERVICE_DAYS = new Set([0, 1, 2, 3, 4]);
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function toMinutes(clock: string): number {
  const [hours = 0, minutes = 0] = clock.split(":").map(Number);
  return hours * MINUTES_PER_HOUR + minutes;
}

/** Today's date, weekday and minute of the day in Cairo. */
function cairoNow(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: APP_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAY_INDEX[parts.weekday ?? "Sun"] ?? 0,
    minute: Number(parts.hour) * MINUTES_PER_HOUR + Number(parts.minute),
  };
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/** Today if the bus still runs today, else the next Sunday-to-Thursday day. */
function nextServiceDate(date: string, weekday: number, runsToday: boolean): string {
  if (runsToday && SERVICE_DAYS.has(weekday)) return date;
  for (let offset = 1; offset <= 7; offset += 1) {
    if (SERVICE_DAYS.has((weekday + offset) % 7)) return addDays(date, offset);
  }
  return date;
}

registerMock(getMyNextTripEndpoint, (_input, { token, language }) => {
  const { user } = requireMockStudent(token);
  const booking = bookingOf(user.id);
  const line = booking && findMockLine(booking.lineId);
  if (!booking || !line || booking.status !== SubscriptionStatus.Active) return { trip: null };

  const stops = line.stops;
  const stopIndex = booking.stopOrder - 1;
  const [pickup = "07:00", nameAr = "", nameEn = ""] = stops[stopIndex] ?? [];
  const now = new Date();
  const cairo = cairoNow(now);
  const pickupMinute = toMinutes(pickup);
  const campusMinute = toMinutes(MOCK_CAMPUS_ARRIVAL.to);
  const firstMinute = toMinutes(stops[0]?.[0] ?? pickup);
  const isToday = SERVICE_DAYS.has(cairo.weekday) && cairo.minute < campusMinute;
  const serviceDate = nextServiceDate(cairo.date, cairo.weekday, isToday);

  let status: NextTrip["status"] = TripStatus.Scheduled;
  let eta: number | null = null;
  let nearStop: string | null = null;
  if (isToday && cairo.minute >= Math.min(firstMinute, pickupMinute - APPROACH_WINDOW_MINUTES)) {
    const passed = stops.filter(([time]) => toMinutes(time) <= cairo.minute).at(-1);
    nearStop = passed ? localized(language, passed[1], passed[2]) : null;
    if (cairo.minute < pickupMinute) {
      status = TripStatus.Approaching;
      eta = pickupMinute - cairo.minute;
    } else {
      status = TripStatus.PassedStop;
      eta = Math.max(0, toMinutes(MOCK_CAMPUS_ARRIVAL.from) - cairo.minute);
    }
  }

  return {
    trip: {
      trip_id: `trp_${line.lineId}_${serviceDate}_out`,
      service_date: serviceDate,
      direction: TripDirection.Outbound,
      line: toLineSummary(line, language),
      stop: { name: localized(language, nameAr, nameEn), pickup_time: pickup },
      campus_arrival: MOCK_CAMPUS_ARRIVAL,
      return_departure_time: null,
      bus: { bus_type: line.busType, plate: line.plate },
      status,
      eta_minutes: eta,
      near_stop: nearStop,
      location_updated_at:
        status === TripStatus.Scheduled
          ? null
          : new Date(now.getTime() - MS_PER_MINUTE / 2).toISOString(),
    },
  };
});
