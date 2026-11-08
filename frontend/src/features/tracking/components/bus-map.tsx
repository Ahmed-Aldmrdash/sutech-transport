"use client";

import type * as Leaflet from "leaflet";
import type { LatLngTuple, Map as LeafletMap, Marker, Polyline } from "leaflet";
import { useTranslations } from "next-intl";
import { Crosshair, Maximize2, Minimize2, Route } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { appConfig } from "@/lib/config";
import type { GeoPoint } from "../geo";

/** From NEXT_PUBLIC_MAP_TILE_URL: a live build must use the university's own tile provider. */
const TILE_URL = appConfig.mapTileUrl;
const TILE_ATTRIBUTION = appConfig.mapAttribution;
const MAX_ZOOM = 18;
const START_ZOOM = 11;
const FIT_MAX_ZOOM = 14;
/** How close "follow the bus" zooms in, at least. */
const BUS_ZOOM = 15;
const FIT_PADDING: [number, number] = [36, 36];
const BUS_SIZE = 40;
const CAMPUS_SIZE = 34;
const STOP_SIZE = 18;
/** Keeps the bus above the campus and stop pins. */
const BUS_Z = 1000;
/** The brand teal (tokens: teal). Leaflet needs a plain colour, not a CSS variable. */
const TRAIL_COLOR = "#257988";
/** How long the bus glides from one GPS fix to the next. */
const GLIDE_MS = 1200;

const BUS_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>';
const CAMPUS_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>';

function busIconHtml(heading: number | null): string {
  const arrow =
    heading === null
      ? ""
      : `<span style="position:absolute;inset:-7px;transform:rotate(${heading}deg)"><span style="position:absolute;left:50%;top:0;width:0;height:0;margin-left:-6px;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:8px solid var(--sut-coral)"></span></span>`;
  return `<span style="position:relative;display:flex;width:40px;height:40px;align-items:center;justify-content:center;border-radius:9999px;background:var(--sut-coral);color:var(--sut-on-coral);box-shadow:0 0 0 4px color-mix(in srgb,var(--sut-coral) 30%,transparent),0 2px 6px rgb(0 0 0/.3)">${arrow}<span style="display:flex;width:22px;height:22px">${BUS_SVG}</span></span>`;
}

const CAMPUS_HTML = `<span style="display:flex;width:34px;height:34px;align-items:center;justify-content:center;border-radius:8px;background:var(--sut-teal);color:var(--sut-on-teal);box-shadow:0 2px 6px rgb(0 0 0/.3)"><span style="display:flex;width:20px;height:20px">${CAMPUS_SVG}</span></span>`;

const STOP_HTML =
  '<span style="display:block;width:18px;height:18px;border-radius:9999px;background:var(--sut-brand);border:3px solid var(--color-white);box-shadow:0 1px 4px rgb(0 0 0/.35)"></span>';

const toTuple = (point: GeoPoint): LatLngTuple => [point.lat, point.lng];

interface BusMapProps {
  bus: (GeoPoint & { heading: number | null }) | null;
  trail: readonly GeoPoint[];
  campus: GeoPoint;
  stop: GeoPoint | null;
  className?: string;
}

interface MapData {
  bus: BusMapProps["bus"];
  trail: readonly GeoPoint[];
  campus: GeoPoint;
  stop: GeoPoint | null;
  labels: { bus: string; campus: string; stop: string };
}

/** Everything Leaflet owns, kept outside React state. */
interface MapState {
  leaflet: typeof Leaflet;
  map: LeafletMap;
  bus: Marker | null;
  trail: Polyline | null;
  stop: Marker | null;
  hasFit: boolean;
  /** The map keeps the bus in view until the user moves the map themselves. */
  follow: boolean;
  /** The last fix drawn, so a re-render with the same fix does not move the map. */
  lastFix: string | null;
  glideFrame: number | null;
}

function marker(
  leaflet: typeof Leaflet,
  at: GeoPoint,
  html: string,
  size: number,
  label: string,
  zIndexOffset = 0,
): Marker {
  return leaflet.marker(toTuple(at), {
    icon: leaflet.divIcon({
      html,
      className: "bus-map-marker",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    }),
    title: label,
    alt: label,
    keyboard: false,
    zIndexOffset,
  });
}

function createMap(
  leaflet: typeof Leaflet,
  container: HTMLElement,
  data: MapData,
  onUserMove: () => void,
): MapState {
  // Drag, pinch, double-tap, the mouse wheel and the +/- buttons all work.
  const map = leaflet.map(container, { scrollWheelZoom: true, zoomSnap: 0.5 });
  map.on("dragstart", onUserMove);
  leaflet.tileLayer(TILE_URL, { maxZoom: MAX_ZOOM, attribution: TILE_ATTRIBUTION }).addTo(map);
  marker(leaflet, data.campus, CAMPUS_HTML, CAMPUS_SIZE, data.labels.campus).addTo(map);
  map.setView(toTuple(data.campus), START_ZOOM);
  return {
    leaflet,
    map,
    bus: null,
    trail: null,
    stop: null,
    hasFit: false,
    follow: true,
    lastFix: null,
    glideFrame: null,
  };
}

/** Slides the marker to the new fix instead of jumping (skipped with reduced motion). */
function glide(state: MapState, target: Marker, to: GeoPoint): void {
  if (state.glideFrame !== null) cancelAnimationFrame(state.glideFrame);
  const from = target.getLatLng();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    target.setLatLng(toTuple(to));
    return;
  }
  const startedAt = performance.now();
  const step = (time: number) => {
    const t = Math.min(1, (time - startedAt) / GLIDE_MS);
    target.setLatLng([from.lat + (to.lat - from.lat) * t, from.lng + (to.lng - from.lng) * t]);
    state.glideFrame = t < 1 ? requestAnimationFrame(step) : null;
  };
  state.glideFrame = requestAnimationFrame(step);
}

function draw(state: MapState, data: MapData): void {
  const { leaflet, map } = state;
  const trailPoints = data.trail.map(toTuple);
  if (state.trail) state.trail.setLatLngs(trailPoints);
  else {
    state.trail = leaflet
      .polyline(trailPoints, { color: TRAIL_COLOR, weight: 5, opacity: 0.75 })
      .addTo(map);
  }

  if (data.stop && !state.stop) {
    state.stop = marker(leaflet, data.stop, STOP_HTML, STOP_SIZE, data.labels.stop).addTo(map);
  }

  const fix = data.bus ? `${data.bus.lat},${data.bus.lng},${data.bus.heading}` : null;
  const isNewFix = fix !== state.lastFix;
  state.lastFix = fix;

  if (data.bus && isNewFix) {
    const html = busIconHtml(data.bus.heading);
    if (!state.bus) {
      state.bus = marker(leaflet, data.bus, html, BUS_SIZE, data.labels.bus, BUS_Z).addTo(map);
    } else {
      state.bus.setIcon(
        leaflet.divIcon({
          html,
          className: "bus-map-marker",
          iconSize: [BUS_SIZE, BUS_SIZE],
          iconAnchor: [BUS_SIZE / 2, BUS_SIZE / 2],
        }),
      );
      glide(state, state.bus, data.bus);
    }
  } else if (!data.bus && state.bus) {
    state.bus.remove();
    state.bus = null;
  }

  if (!state.hasFit && data.bus) {
    showWholeTrip(state, data, false);
    state.hasFit = true;
  } else if (state.follow && data.bus && isNewFix) {
    map.panTo(toTuple(data.bus), { animate: true, duration: GLIDE_MS / 1000 });
  }
}

/** Zooms out to the bus, its trail, the stop and campus together. */
function showWholeTrip(state: MapState, data: MapData, animate: boolean): void {
  const points = [data.campus, ...data.trail, ...(data.bus ? [data.bus] : [])];
  if (data.stop) points.push(data.stop);
  const bounds = state.leaflet.latLngBounds(points.map(toTuple));
  state.map.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM, animate });
}

/**
 * The live map: the bus (with its heading), where it has been, the rider's stop when known,
 * and campus. Leaflet loads only in the browser. It opens on the whole trip, then follows the
 * bus. Dragging the map stops following, so it never fights the user; "Follow the bus" brings
 * it back. Full screen is for phones.
 */
export function BusMap({ bus, trail, campus, stop, className }: BusMapProps) {
  const t = useTranslations("tracking.map");
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<MapState | null>(null);
  const dataRef = useRef<MapData | null>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Create the map once; Leaflet itself loads only in the browser.
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((leaflet) => {
      const container = containerRef.current;
      const data = dataRef.current;
      if (cancelled || !container || !data || stateRef.current) return;
      stateRef.current = createMap(leaflet, container, data, () => {
        if (stateRef.current) stateRef.current.follow = false;
        setIsFollowing(false);
      });
      draw(stateRef.current, data);
    });
    return () => {
      cancelled = true;
      const state = stateRef.current;
      if (state && state.glideFrame !== null) cancelAnimationFrame(state.glideFrame);
      // Stop any pan or zoom first: removing a map mid-animation makes Leaflet throw.
      state?.map.stop();
      state?.map.off();
      state?.map.remove();
      stateRef.current = null;
    };
  }, []);

  // Every render: keep the latest data and redraw.
  useEffect(() => {
    const data: MapData = {
      bus,
      trail,
      campus,
      stop,
      labels: { bus: t("bus"), campus: t("campus"), stop: t("stop") },
    };
    dataRef.current = data;
    if (stateRef.current) draw(stateRef.current, data);
  });

  // The map must re-measure itself after its box changes size.
  useEffect(() => {
    stateRef.current?.map.invalidateSize();
    if (!isFullScreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullScreen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isFullScreen]);

  function centerOnBus() {
    const state = stateRef.current;
    const data = dataRef.current;
    if (!state || !data?.bus) return;
    state.follow = true;
    setIsFollowing(true);
    state.map.setView(toTuple(data.bus), Math.max(state.map.getZoom(), BUS_ZOOM), {
      animate: true,
    });
  }

  function wholeTrip() {
    const state = stateRef.current;
    const data = dataRef.current;
    if (!state || !data) return;
    state.follow = false;
    setIsFollowing(false);
    showWholeTrip(state, data, true);
  }

  const control =
    "inline-flex h-10 items-center gap-2 rounded-md border border-line bg-surface-raised px-3 text-body-sm font-bold text-ink-strong shadow-card focus-ring hover:bg-surface-alt";

  return (
    <div
      className={cn(
        "relative",
        isFullScreen ? "fixed inset-0 z-50 bg-surface p-2" : "h-80 w-full",
        isFullScreen ? undefined : className,
      )}
    >
      <div
        ref={containerRef}
        role="region"
        aria-label={t("label")}
        className="bus-map h-full w-full overflow-hidden rounded-card border border-line"
      />
      <div className="pointer-events-none absolute end-3 top-3 z-[500] flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={centerOnBus}
          disabled={!bus}
          aria-pressed={isFollowing}
          className={cn(
            control,
            "pointer-events-auto disabled:opacity-50",
            isFollowing && "border-brand text-brand",
          )}
        >
          <Crosshair aria-hidden="true" className="size-4" />
          {isFollowing ? t("following") : t("followBus")}
        </button>
        <button type="button" onClick={wholeTrip} className={cn(control, "pointer-events-auto")}>
          <Route aria-hidden="true" className="size-4" />
          {t("wholeTrip")}
        </button>
        <button
          type="button"
          onClick={() => setIsFullScreen(!isFullScreen)}
          className={cn(control, "pointer-events-auto")}
        >
          {isFullScreen ? (
            <Minimize2 aria-hidden="true" className="size-4" />
          ) : (
            <Maximize2 aria-hidden="true" className="size-4" />
          )}
          {isFullScreen ? t("exitFullScreen") : t("fullScreen")}
        </button>
      </div>
    </div>
  );
}
