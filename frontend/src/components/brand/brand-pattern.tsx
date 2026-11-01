import { useId } from "react";
import { cn } from "@/lib/cn";
import { MARK_PATHS, MARK_VIEWBOX } from "./mark-paths";

interface BrandPatternProps {
  /** "onBrand" for purple/dark grounds (white shapes), "brand" for light grounds. */
  tone?: "onBrand" | "brand";
  className?: string;
}

const TILE = 200;
const MARK_SIZE = 44;
const OFFSET = 16;
const HALF = TILE / 2 + OFFSET;

/**
 * The logo's three shapes repeated as a quiet background pattern (splash, login, empty states).
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
          <svg
            x={OFFSET}
            y={OFFSET}
            width={MARK_SIZE}
            height={MARK_SIZE}
            viewBox={MARK_VIEWBOX}
            fill="currentColor"
          >
            <path d={MARK_PATHS.purple} />
            <path d={MARK_PATHS.coral} />
            <path d={MARK_PATHS.teal} />
          </svg>
          <svg
            x={HALF}
            y={HALF}
            width={MARK_SIZE}
            height={MARK_SIZE}
            viewBox={MARK_VIEWBOX}
            fill="currentColor"
          >
            <path d={MARK_PATHS.purple} />
            <path d={MARK_PATHS.coral} />
            <path d={MARK_PATHS.teal} />
          </svg>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
