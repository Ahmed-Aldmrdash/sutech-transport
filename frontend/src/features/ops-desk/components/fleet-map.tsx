"use client";

import type * as Leaflet from "leaflet";
import type { Map as LeafletMap, Marker } from "leaflet";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import type { GeoPoint } from "@/features/tracking/geo";
import { appConfig } from "@/lib/config";

const START_ZOOM = 10;
const MAX_ZOOM = 18;
const FIT_MAX_ZOOM = 13;
const FIT_PADDING: [number, number] = [40, 40];
const SELECTED_ZOOM = 14;
const CAMPUS_SIZE = 30;

export interface FleetMapBus {
  id: string;
  /** The line number, drawn on the pin. */
  code: string;
  label: string;
  position: GeoPoint;
  /** An open SOS or a delay: drawn in red or amber. */
  alert: "sos" | "late" | null;
}

interface FleetMapProps {
  buses: readonly FleetMapBus[];
  campus: GeoPoint;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

interface State {
  leaflet: typeof Leaflet;
  map: LeafletMap;
  markers: Map<string, Marker>;
  hasFit: boolean;
}

const tuple = (point: GeoPoint): [number, number] => [point.lat, point.lng];

function pinHtml(bus: FleetMapBus, selected: boolean): string {
  const background =
    bus.alert === "sos"
      ? "var(--sut-danger)"
      : bus.alert === "late"
        ? "var(--sut-warning)"
        : "var(--sut-coral)";
  const ink = bus.alert === "late" ? "#1F1F1F" : "#FFFFFF";
  const ring = selected ? "0 0 0 4px var(--sut-brand)" : "0 0 0 2px var(--color-white)";
  return `<span style="display:flex;min-width:36px;height:28px;padding:0 6px;align-items:center;justify-content:center;border-radius:9999px;background:${background};color:${ink};font:700 13px/1 system-ui;box-shadow:${ring},0 2px 6px rgb(0 0 0/.35)">${bus.code}</span>`;
}

const CAMPUS_HTML = `<span style="display:block;width:${CAMPUS_SIZE}px;height:${CAMPUS_SIZE}px;border-radius:8px;background:var(--sut-teal);box-shadow:0 2px 6px rgb(0 0 0/.3)"></span>`;

function icon(leaflet: typeof Leaflet, html: string, size: [number, number]) {
  return leaflet.divIcon({
    html,
    className: "bus-map-marker",
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1] / 2],
  });
}

/**
 * Every bus on the road on one map, each pin showing its line number. A pin in red has an
 * open SOS, in amber a delay. Choosing a pin (or a row in the list) selects that bus.
 */
export function FleetMap({ buses, campus, selectedId, onSelect }: FleetMapProps) {
  const t = useTranslations("desk.ops.live");
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<State | null>(null);
  const latest = useRef({ buses, campus, selectedId, onSelect });

  useEffect(() => {
    latest.current = { buses, campus, selectedId, onSelect };
  });

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((leaflet) => {
      const container = containerRef.current;
      if (cancelled || !container || stateRef.current) return;
      const map = leaflet.map(container, { scrollWheelZoom: true, zoomSnap: 0.5 });
      leaflet
        .tileLayer(appConfig.mapTileUrl, {
          maxZoom: MAX_ZOOM,
          attribution: appConfig.mapAttribution,
        })
        .addTo(map);
      leaflet
        .marker(tuple(latest.current.campus), {
          icon: icon(leaflet, CAMPUS_HTML, [CAMPUS_SIZE, CAMPUS_SIZE]),
          title: t("campus"),
          keyboard: false,
        })
        .addTo(map);
      map.setView(tuple(latest.current.campus), START_ZOOM);
      stateRef.current = { leaflet, map, markers: new Map(), hasFit: false };
      drawPins(stateRef.current, latest.current);
    });
    return () => {
      cancelled = true;
      stateRef.current?.map.stop();
      stateRef.current?.map.off();
      stateRef.current?.map.remove();
      stateRef.current = null;
    };
  }, [t]);

  useEffect(() => {
    if (stateRef.current) drawPins(stateRef.current, latest.current);
  });

  useEffect(() => {
    const state = stateRef.current;
    const bus = buses.find((item) => item.id === selectedId);
    if (state && bus) {
      state.map.setView(tuple(bus.position), Math.max(state.map.getZoom(), SELECTED_ZOOM), {
        animate: true,
      });
    }
    // Only when the choice changes, not on every position update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={t("mapLabel")}
      className="bus-map h-96 w-full overflow-hidden rounded-card border border-line desktop:h-[32rem]"
    />
  );
}

function drawPins(state: State, data: FleetMapProps): void {
  const { leaflet, map, markers } = state;
  const seen = new Set<string>();
  for (const bus of data.buses) {
    seen.add(bus.id);
    const html = pinHtml(bus, bus.id === data.selectedId);
    const existing = markers.get(bus.id);
    if (existing) {
      existing.setLatLng(tuple(bus.position));
      existing.setIcon(icon(leaflet, html, [44, 28]));
      existing.setZIndexOffset(bus.id === data.selectedId ? 1000 : 0);
    } else {
      const marker = leaflet
        .marker(tuple(bus.position), {
          icon: icon(leaflet, html, [44, 28]),
          title: bus.label,
          alt: bus.label,
          keyboard: false,
        })
        .addTo(map);
      marker.on("click", () => data.onSelect(bus.id));
      markers.set(bus.id, marker);
    }
  }
  for (const [id, marker] of markers) {
    if (!seen.has(id)) {
      marker.remove();
      markers.delete(id);
    }
  }
  if (!state.hasFit && data.buses.length > 0) {
    const points = [data.campus, ...data.buses.map((bus) => bus.position)].map(tuple);
    map.fitBounds(leaflet.latLngBounds(points), { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM });
    state.hasFit = true;
  }
}
