import { BusType, type Line, type LineDetail, type LineSummary, type Stop } from "./schema";
import { MOCK_LINES, type MockLineSource } from "./mock-lines";

/** One term on any line costs 15,000 EGP (registration letter, Fall 2026). */
export const MOCK_TERM_PRICE_PIASTERS = 1_500_000;

/** Ahmed, 2026-11-02: every bus reaches campus between 8:45 and 9:00. */
export const MOCK_CAMPUS_ARRIVAL = { from: "08:45", to: "09:00" } as const;

/** Seats by bus type. Estimates until the bus company sends the exact count per bus. */
export const MOCK_SEATS_BY_BUS: Record<BusType, number> = {
  [BusType.Minibus]: 14,
  [BusType.Coaster]: 28,
  [BusType.Midibus]: 33,
  [BusType.LargeBus]: 50,
};

/** Picks the Arabic or English text, as the server does from Accept-Language. */
export function localized(language: string, arabic: string, english: string): string {
  return language === "en" ? english : arabic;
}

export function findMockLine(lineId: string): MockLineSource | undefined {
  return MOCK_LINES.find((line) => line.lineId === lineId);
}

export function mockStopId(lineId: string, order: number): string {
  return `${lineId}_s${order}`;
}

export function toLineSummary(source: MockLineSource, language: string): LineSummary {
  return {
    line_id: source.lineId,
    code: source.code,
    name: localized(language, source.nameAr, source.nameEn),
  };
}

export function toStops(source: MockLineSource, language: string): Stop[] {
  return source.stops.map(([time, nameAr, nameEn, noteAr, noteEn], index) => ({
    stop_id: mockStopId(source.lineId, index + 1),
    order: index + 1,
    name: localized(language, nameAr, nameEn),
    note: noteAr && noteEn ? localized(language, noteAr, noteEn) : null,
    pickup_time: time,
    location: null,
  }));
}

export function toLine(source: MockLineSource, language: string, seatsHeld: number): Line {
  return {
    ...toLineSummary(source, language),
    price_piasters: MOCK_TERM_PRICE_PIASTERS,
    bus_type: source.busType,
    seats_total: MOCK_SEATS_BY_BUS[source.busType],
    seats_available: Math.max(0, source.seatsAvailable - seatsHeld),
    stop_count: source.stops.length,
    first_pickup_time: source.stops[0]?.[0] ?? null,
    campus_arrival: MOCK_CAMPUS_ARRIVAL,
    return_departure_time: null,
  };
}

export function toLineDetail(
  source: MockLineSource,
  language: string,
  seatsHeld: number,
): LineDetail {
  return { ...toLine(source, language, seatsHeld), stops: toStops(source, language) };
}
