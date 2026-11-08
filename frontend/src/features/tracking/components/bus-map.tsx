"use client";

import type { LatLngTuple } from "leaflet";
import { useTranslations } from "next-intl";
import { Crosshair, Maximize2, Minimize2, Route } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { GeoPoint } from "../geo";
import { type MapData, type MapState, createMap, draw, showWholeTrip } from "./bus-map-layers";
/** How close "follow the bus" zooms in, at least. */
const BUS_ZOOM = 15;

export const toTuple = (point: GeoPoint): LatLngTuple => [point.lat, point.lng];

export interface BusMapProps {
  bus: (GeoPoint & { heading: number | null }) | null;
  trail: readonly GeoPoint[];
  campus: GeoPoint;
  stop: GeoPoint | null;
  className?: string;
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
    "tap-area inline-flex h-10 items-center gap-2 rounded-md border border-line bg-surface-raised px-3 text-body-sm font-bold text-ink-strong shadow-card focus-ring hover:bg-surface-alt";

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
