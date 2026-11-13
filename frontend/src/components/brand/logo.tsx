import { cn } from "@/lib/cn";
import { MARK_PATHS, MARK_VIEWBOX } from "./mark-paths";

/** Official colours on light grounds; the official all-white mark in dark theme. */
const COLOR_MARK_CLASSES = {
  purple: "fill-[#58286e] dark:fill-white",
  coral: "fill-[#cf644b] dark:fill-white",
  teal: "fill-[#257988] dark:fill-white",
} as const;

interface LogoMarkProps {
  /**
   * "color": the official colours on light grounds, switching to the white mark in dark theme
   * (the purple shape would disappear into the dark background).
   * "white": all-white mark for purple or photo grounds.
   */
  variant?: "color" | "white";
  className?: string;
  /** Accessible name. Leave empty when a visible wordmark sits next to it. */
  title?: string;
}

export function LogoMark({ variant = "color", className, title }: LogoMarkProps) {
  const shapeClass = (shape: keyof typeof COLOR_MARK_CLASSES) =>
    variant === "white" ? "fill-white" : COLOR_MARK_CLASSES[shape];
  return (
    <svg
      viewBox={MARK_VIEWBOX}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn("size-8 shrink-0", className)}
    >
      <path d={MARK_PATHS.purple} className={shapeClass("purple")} />
      <path d={MARK_PATHS.coral} className={shapeClass("coral")} />
      <path d={MARK_PATHS.teal} className={shapeClass("teal")} />
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
