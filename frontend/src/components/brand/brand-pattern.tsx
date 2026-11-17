import { useId } from "react";
import { cn } from "@/lib/cn";
import { MARK, MARK_VIEWBOX } from "./mark-paths";

interface BrandPatternProps {
  /** "onBrand" for purple/dark grounds (white shapes), "brand" for light grounds. */
  tone?: "onBrand" | "brand";
  className?: string;
}

const TILE = 200;
const MARK_SIZE = 44;
const OFFSET = 16;
const HALF = TILE / 2 + OFFSET;

/** The mark in one colour, holes cut through, as in the official white logo. */
function MarkShape({ maskId }: { maskId: string }) {
  const { stop, pinHole } = MARK;
  return (
    <>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
        <path
          d={MARK.road}
          fill="none"
          stroke="#fff"
          strokeWidth={MARK.roadWidth}
          strokeLinecap="round"
        />
        <circle cx={stop.cx} cy={stop.cy} r={stop.r} fill="#fff" />
        <circle cx={stop.cx} cy={stop.cy} r={stop.hole} fill="#000" />
        <path d={MARK.pin} fill="#fff" />
        <circle cx={pinHole.cx} cy={pinHole.cy} r={pinHole.r} fill="#000" />
      </mask>
      <rect width="512" height="512" fill="currentColor" mask={`url(#${maskId})`} />
    </>
  );
}

/**
 * The logo mark repeated as a quiet background pattern (splash, login, empty states).
 * Decorative only. Fills the nearest positioned parent.
 */
export function BrandPattern({ tone = "onBrand", className }: BrandPatternProps) {
  const id = useId().replace(/:/g, "");
  const color = tone === "onBrand" ? "text-white/[0.07]" : "text-brand/[0.06]";

  return (
    <svg
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 size-full", color, className)}
    >
      <defs>
        <pattern id={id} width={TILE} height={TILE} patternUnits="userSpaceOnUse">
          <svg x={OFFSET} y={OFFSET} width={MARK_SIZE} height={MARK_SIZE} viewBox={MARK_VIEWBOX}>
            <MarkShape maskId={`${id}-a`} />
          </svg>
          <svg x={HALF} y={HALF} width={MARK_SIZE} height={MARK_SIZE} viewBox={MARK_VIEWBOX}>
            <MarkShape maskId={`${id}-b`} />
          </svg>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
