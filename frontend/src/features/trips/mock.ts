import {
  MOCK_CAMPUS_ARRIVAL,
  findMockLine,
  localized,
  toBus,
  toLineSummary,
} from "@/features/lines/mock-builders";
import { lineSourceOn } from "@/features/crew/mock-state";
import { mockReturnTime } from "@/features/lines/mock-timetable";
import { bookingOnDate } from "@/features/requests/mock-riding-line";
import { requireMockStudent } from "@/features/subscriptions/mock";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import {
  MS_PER_MINUTE,
  SERVICE_DAYS,
  addDays,
  cairoNow,
  toMinutes,
} from "@/lib/api/mock/cairo-clock";
import { registerMock } from "@/lib/api/mock/mock-server";
import { getMyNextTripEndpoint } from "./api";
import { TripDirection, TripStatus, type NextTrip } from "./schema";

/** The bus counts as "on its way to you" this long before your pickup time. */
const APPROACH_WINDOW_MINUTES = 40;

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
  const now = new Date();
  const cairo = cairoNow(now);
  const campusMinute = toMinutes(MOCK_CAMPUS_ARRIVAL.to);
  const isToday = SERVICE_DAYS.has(cairo.weekday) && cairo.minute < campusMinute;
  const serviceDate = nextServiceDate(cairo.date, cairo.weekday, isToday);
  // That day's line (an approved change moves it) and that day's bus, not today's.
  const booking = bookingOnDate(user.id, serviceDate, now.getTime());
  const line = booking && findMockLine(booking.lineId);
  if (!booking || !line || booking.status !== SubscriptionStatus.Active) return { trip: null };

  const stops = line.stops;
  const [pickup = "07:00", nameAr = "", nameEn = ""] = stops[booking.stopOrder - 1] ?? [];
  const pickupMinute = toMinutes(pickup);
  const firstMinute = toMinutes(stops[0]?.[0] ?? pickup);

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
      return_departure_time: mockReturnTime(line.lineId),
      bus: toBus(lineSourceOn(line, serviceDate), language, true),
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
