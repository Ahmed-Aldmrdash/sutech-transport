import { cn } from "@/lib/cn";

/**
 * The project's mark (the "S road", chosen 2026-11-16): a teal road shaped like an S with a
 * dashed centre line, the coral stop where it starts and the purple pin where it ends. The
 * same shapes as public/brand/sutech-transport-mark.svg (viewBox 0 0 512 512).
 */
const ROAD = "M372,104 H216 A80,80 0 0 0 216,264 H296 A80,80 0 0 1 296,424 H232";
const CENTRE_LINE = "M352,104 H216 A80,80 0 0 0 216,264 H296 A80,80 0 0 1 296,424 H250";
/** Every white mark on a page draws the same cut-outs, so they can share one mask. */
const WHITE_MASK_ID = "sut-mark-cutouts";
const PIN = "M171.9,399.3 A60,60 0 1 0 72.1,399.3 L111.0,457.6 Q122,474 133.0,457.6 Z";

/** Official colours; in dark theme the purple pin takes the official light tint to stay seen. */
const COLOR_CLASSES = {
  road: "stroke-[#257988]",
  stop: "fill-[#cf644b]",
  pin: "fill-[#58286e] dark:fill-[#bfa1ce]",
  hole: "fill-white",
} as const;

interface LogoMarkProps {
  /**
   * "color": the official colours (the pin lightens in dark theme).
   * "white": all-white mark for purple or photo grounds.
   */
  variant?: "color" | "white";
  className?: string;
  /** Accessible name. Leave empty when a visible wordmark sits next to it. */
  title?: string;
}

export function LogoMark({ variant = "color", className, title }: LogoMarkProps) {
  const common = {
    viewBox: "0 0 512 512",
    role: title ? "img" : undefined,
    "aria-hidden": title ? undefined : true,
    "aria-label": title,
    className: cn("size-8 shrink-0", className),
  } as const;
  if (variant === "white") {
    // All white, with the centre line and the holes cut out so the ground shows through.
    return (
      <svg {...common}>
        <mask id={WHITE_MASK_ID}>
          <rect width={512} height={512} fill="white" />
          <path
            d={CENTRE_LINE}
            fill="none"
            stroke="black"
            strokeWidth={7}
            strokeDasharray="20 17.23"
            strokeLinecap="round"
          />
          <circle cx={398} cy={104} r={23.2} fill="black" />
          <circle cx={122} cy={366} r={24} fill="black" />
        </mask>
        <g mask={`url(#${WHITE_MASK_ID})`} className="fill-white stroke-white">
          <path d={ROAD} fill="none" strokeWidth={76} strokeLinecap="round" />
          <circle cx={398} cy={104} r={58} stroke="none" />
          <path d={PIN} stroke="none" />
        </g>
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path
        d={ROAD}
        fill="none"
        strokeWidth={76}
        strokeLinecap="round"
        className={COLOR_CLASSES.road}
      />
      <path
        d={CENTRE_LINE}
        fill="none"
        strokeWidth={7}
        strokeDasharray="20 17.23"
        strokeLinecap="round"
        className="stroke-white"
      />
      <circle cx={398} cy={104} r={58} className={COLOR_CLASSES.stop} />
      <circle cx={398} cy={104} r={23.2} className="fill-white" />
      <path d={PIN} className={COLOR_CLASSES.pin} />
      <circle cx={122} cy={366} r={24} className={COLOR_CLASSES.hole} />
    </svg>
  );
}

interface LogoProps {
  /** Product name next to the mark, from the translations. */
  name: string;
  /** Second line, e.g. "Transportation". */
  tagline?: string;
  variant?: "color" | "white";
  className?: string;
  /** Extra classes for the tagline, e.g. hiding it on very narrow phones. */
  taglineClassName?: string;
}

/** Mark + product name. The text is live HTML so it follows the theme and the language. */
export function Logo({ name, tagline, variant = "color", className, taglineClassName }: LogoProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
      <LogoMark variant={variant} />
      <span className="flex min-w-0 flex-col leading-none">
        {/* One line, always: a long name is cut with "…" rather than spilling over the page. */}
        <span
          className={cn(
            "truncate text-h3 font-extrabold tracking-[-0.3px] [&:lang(ar)]:tracking-normal",
            variant === "white" ? "text-white" : "text-ink-strong",
          )}
        >
          {name}
        </span>
        {tagline ? (
          <span
            className={cn(
              "mt-1 truncate text-caption",
              taglineClassName,
              variant === "white" ? "text-white/80" : "text-ink-muted",
            )}
          >
            {tagline}
          </span>
        ) : null}
      </span>
    </span>
  );
}
