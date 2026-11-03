import type { GeoPoint } from "./geo";

/**
 * Mock only. The office hasn't sent stop locations or the campus pin yet, so the demo bus
 * drives from the middle of its line's area to campus along a few rough points on the main
 * roads. Real positions come from the GPS device in each bus.
 */

/** About Km 51 on the Cairo – Ismailia desert road. To be replaced by the real campus pin. */
export const MOCK_CAMPUS: GeoPoint = { lat: 30.2128, lng: 31.695 };

const point = (lat: number, lng: number): GeoPoint => ({ lat, lng });

/** Rough points on the way out of Cairo, east to campus. */
const RING_ROAD_EAST = point(30.045, 31.405);
const SUEZ_ROAD_JUNCTION = point(30.118, 31.428);
const SHOROUK_EXIT = point(30.158, 31.6);
const CAIRO_EXIT = [SUEZ_ROAD_JUNCTION, SHOROUK_EXIT] as const;
const FROM_SOUTH = [RING_ROAD_EAST, ...CAIRO_EXIT] as const;

/** Where each line's bus starts, and the road points it takes to campus. */
const LINE_PATHS: Readonly<Record<string, readonly GeoPoint[]>> = {
  ln_01_1: [point(30.296, 31.745), point(30.26, 31.735)],
  ln_01_2: [point(30.31, 31.772), point(30.265, 31.74)],
  ln_02: [point(30.596, 32.271), point(30.42, 32.0), point(30.3, 31.82)],
  ln_03: [point(29.966, 32.55), point(30.07, 32.1), point(30.17, 31.8)],
  ln_04: [point(30.716, 31.259), point(30.587, 31.502), point(30.4, 31.65)],
  ln_05: [point(30.028, 31.468), point(30.07, 31.49), ...CAIRO_EXIT.slice(1)],
  ln_06: [point(30.059, 31.493), point(30.1, 31.53), SHOROUK_EXIT],
  ln_07: [point(30.128, 31.612), SHOROUK_EXIT],
  ln_08: [point(30.093, 31.64), point(30.13, 31.63), SHOROUK_EXIT],
  ln_09: [point(30.218, 31.468), point(30.19, 31.53), SHOROUK_EXIT],
  ln_10: [point(30.114, 31.345), ...CAIRO_EXIT],
  ln_11: [point(30.09, 31.322), ...CAIRO_EXIT],
  ln_12: [point(30.058, 31.343), point(30.08, 31.39), ...CAIRO_EXIT],
  ln_13: [point(30.072, 31.283), point(30.09, 31.33), ...CAIRO_EXIT],
  ln_14_1: [point(29.99, 31.152), point(30.0, 31.25), ...FROM_SOUTH],
  ln_14_2: [point(30.002, 31.17), point(30.0, 31.25), ...FROM_SOUTH],
  ln_15: [point(29.972, 30.94), point(29.99, 31.1), point(30.0, 31.25), ...FROM_SOUTH],
  ln_16: [point(30.012, 31.197), point(30.0, 31.25), ...FROM_SOUTH],
  ln_17: [point(29.96, 31.258), point(29.99, 31.32), ...FROM_SOUTH],
  ln_18: [point(30.008, 31.248), point(30.0, 31.29), ...FROM_SOUTH],
  ln_19: [point(30.018, 31.3), point(30.02, 31.36), ...FROM_SOUTH],
  ln_20: [point(30.466, 31.184), point(30.3, 31.4), point(30.22, 31.55)],
  ln_21: [point(29.85, 31.334), point(29.95, 31.36), ...FROM_SOUTH],
  ln_22: [point(29.97, 31.29), point(30.0, 31.35), ...FROM_SOUTH],
  ln_23: [point(30.124, 31.36), ...CAIRO_EXIT],
};

/** The demo route of a line, ending at campus. */
export function mockPathOf(lineId: string): GeoPoint[] {
  return [...(LINE_PATHS[lineId] ?? [SUEZ_ROAD_JUNCTION]), MOCK_CAMPUS];
}
