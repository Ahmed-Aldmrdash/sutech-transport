import { addDays, cairoInstant, cairoNow } from "@/lib/api/mock/cairo-clock";
import { MockStorage, StoredMap } from "@/lib/api/mock/stored-map";
import { BookingWindowAction, BookingWindowStatus, windowStatusAt } from "./schema";

/**
 * The mock server's booking window. A fresh demo starts with booking open: it opened three
 * weeks ago and closes ten days from the first visit, so every demo account can book.
 */
export interface MockWindowChange {
  action: BookingWindowAction;
  opensAt: number | null;
  closesAt: number | null;
  note: string | null;
  byId: string;
  at: number;
}

export interface MockBookingWindow {
  opensAt: number | null;
  closesAt: number | null;
  history: MockWindowChange[];
}

const KEY = "term";
const store = new StoredMap<MockBookingWindow>("sut.mock.bookingWindow", MockStorage.Local);

const OPENED_DAYS_AGO = 21;
const CLOSES_IN_DAYS = 10;

function seed(now: number): MockBookingWindow {
  const cairo = cairoNow(new Date(now));
  const opensAt = cairoInstant(addDays(cairo.date, -OPENED_DAYS_AGO), "09:00", cairo.offsetMinutes);
  const closesAt = cairoInstant(addDays(cairo.date, CLOSES_IN_DAYS), "23:59", cairo.offsetMinutes);
  return {
    opensAt,
    closesAt,
    history: [
      {
        action: BookingWindowAction.Open,
        opensAt,
        closesAt,
        note: null,
        byId: "usr_transport_1",
        at: opensAt,
      },
    ],
  };
}

export function bookingWindowOf(now = Date.now()): MockBookingWindow {
  const saved = store.get(KEY);
  if (saved) return saved;
  const fresh = seed(now);
  store.set(KEY, fresh);
  return fresh;
}

export function saveBookingWindow(window: MockBookingWindow): void {
  store.set(KEY, window);
}

export function isBookingOpen(now = Date.now()): boolean {
  const window = bookingWindowOf(now);
  return windowStatusAt(window.opensAt, window.closesAt, now) === BookingWindowStatus.Open;
}

/** Test helper. */
export function resetBookingWindowMock(): void {
  store.clear();
}
