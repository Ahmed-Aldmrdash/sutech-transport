import { cn } from "@/lib/cn";

/** Horizontal fill bar (seats booked of capacity). Turns warning at 90%. */
export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-2 w-full overflow-hidden rounded-full bg-surface-alt">
      <div className={cn("h-full rounded-full", percent >= 90 ? "bg-warning" : "bg-brand")} style={{ width: `${percent}%` }} />
    </div>
  );
}
