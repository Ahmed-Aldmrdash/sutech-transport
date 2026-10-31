"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import { cn } from "@/lib/cn";
import type { BusPosition, LiveLine } from "../schema";

const BUS_ICON = L.divIcon({
  className: "",
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  html: `<span style="display:grid;place-items:center;width:36px;height:36px;border-radius:9999px;background:#257988;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg></span>`,
});

function FitToRoute({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [24, 24] });
  }, [map, points]);
  return null;
}

/** Leaflet map of one line: the route, its stops (passed ones faded, the student's own stop ringed) and the bus. */
export default function TrackingMap({
  line,
  position,
  myStopId,
  label,
  className,
}: {
  line: Pick<LiveLine, "stops">;
  position: BusPosition | null;
  myStopId?: string;
  label: string;
  /** Overrides the default height (e.g. a taller map on laptops). */
  className?: string;
}) {
  const points = useMemo(() => line.stops.map((stop) => [stop.lat, stop.lng] as [number, number]), [line.stops]);
  return (
    <div role="img" aria-label={label} className={cn("h-64 overflow-hidden rounded-card border border-line sm:h-80", className)}>
      <MapContainer center={points[0] ?? [30.0, 31.5]} zoom={11} scrollWheelZoom={false} className="h-full w-full" attributionControl>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitToRoute points={points} />
        <Polyline positions={points} pathOptions={{ color: "#58286E", weight: 4, opacity: 0.7 }} />
        {line.stops.map((stop) => (
          <CircleMarker
            key={stop.id}
            center={[stop.lat, stop.lng]}
            radius={stop.id === myStopId ? 9 : 6}
            pathOptions={{
              color: stop.id === myStopId ? "#CF644B" : "#58286E",
              weight: stop.id === myStopId ? 4 : 2,
              fillColor: "#ffffff",
              fillOpacity: stop.passed ? 0.5 : 1,
              opacity: stop.passed ? 0.5 : 1,
            }}
          >
            <Tooltip>{stop.name}</Tooltip>
          </CircleMarker>
        ))}
        {position && <Marker position={[position.lat, position.lng]} icon={BUS_ICON} />}
      </MapContainer>
    </div>
  );
}
