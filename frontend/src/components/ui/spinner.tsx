import { cn } from "@/lib/cn";

interface SpinnerProps {
  className?: string;
  /** Read by screen readers. Omit when the surrounding control already announces it. */
  label?: string;
}

export function Spinner({ className, label }: SpinnerProps) {
  return (
    <span role={label ? "status" : undefined} className={cn("inline-flex", className)}>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-5 animate-spin motion-reduce:animate-none"
        fill="none"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
