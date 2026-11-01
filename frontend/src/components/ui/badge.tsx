import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { SOFT_TONE_CLASSES, type Tone } from "./tone";

interface BadgeProps {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A status pill: "Active", "Pending", "Absent". */
export function Badge({ tone = "neutral", icon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-7 max-w-full items-center gap-1.5 rounded-pill border px-2.5 text-caption font-bold whitespace-nowrap",
        "[&_svg]:size-3.5 [&_svg]:shrink-0",
        SOFT_TONE_CLASSES[tone],
        className,
      )}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex">
          {icon}
        </span>
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Pulsing teal dot for anything live (bus position, live trip). Still with reduced motion. */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2.5 animate-live rounded-full bg-teal", className)}
    />
  );
}
