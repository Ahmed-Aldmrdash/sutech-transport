/** Small geometry helpers for the map and the mock bus. Distances are good to a few metres. */

export interface GeoPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;
const DEGREES_TO_RADIANS = Math.PI / 180;
const FULL_CIRCLE = 360;

function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = (b.lat - a.lat) * DEGREES_TO_RADIANS;
  const dLng = (b.lng - a.lng) * DEGREES_TO_RADIANS;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * DEGREES_TO_RADIANS) *
      Math.cos(b.lat * DEGREES_TO_RADIANS) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Compass bearing from a to b: 0 = north, 90 = east. */
function bearingDegrees(a: GeoPoint, b: GeoPoint): number {
  const lat1 = a.lat * DEGREES_TO_RADIANS;
  const lat2 = b.lat * DEGREES_TO_RADIANS;
  const dLng = (b.lng - a.lng) * DEGREES_TO_RADIANS;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) / DEGREES_TO_RADIANS + FULL_CIRCLE) % FULL_CIRCLE;
}

function lerpPoint(a: GeoPoint, b: GeoPoint, t: number): GeoPoint {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

export function pathLengthKm(path: readonly GeoPoint[]): number {
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    total += distanceKm(path[index - 1] as GeoPoint, path[index] as GeoPoint);
  }
  return total;
}

/** The point a fraction (0 to 1) of the way along a path, and the bearing there. */
export function pointAlong(
  path: readonly GeoPoint[],
  fraction: number,
): { point: GeoPoint; heading: number } {
  const first = path[0];
  if (!first) throw new Error("Empty path");
  const target = Math.min(1, Math.max(0, fraction)) * pathLengthKm(path);
  let walked = 0;
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1] as GeoPoint;
    const to = path[index] as GeoPoint;
    const leg = distanceKm(from, to);
    if (walked + leg >= target || index === path.length - 1) {
      const t = leg === 0 ? 0 : Math.min(1, (target - walked) / leg);
      return { point: lerpPoint(from, to, t), heading: bearingDegrees(from, to) };
    }
    walked += leg;
  }
  return { point: first, heading: 0 };
}

/** The path from its start to a fraction (0 to 1) of the way along, every bend included. */
export function pathUntil(path: readonly GeoPoint[], fraction: number): GeoPoint[] {
  const first = path[0];
  if (!first) return [];
  const target = Math.min(1, Math.max(0, fraction)) * pathLengthKm(path);
  const walkedPath: GeoPoint[] = [first];
  let walked = 0;
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1] as GeoPoint;
    const to = path[index] as GeoPoint;
    const leg = distanceKm(from, to);
    if (walked + leg >= target) {
      walkedPath.push(lerpPoint(from, to, leg === 0 ? 0 : (target - walked) / leg));
      return walkedPath;
    }
    walkedPath.push(to);
    walked += leg;
  }
  return walkedPath;
}
