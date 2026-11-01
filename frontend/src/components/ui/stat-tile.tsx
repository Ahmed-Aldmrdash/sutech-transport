import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface StatTileProps {
  label: ReactNode;
  value: ReactNode;
  /** Context under the value: "of 48 seats", "+3 since yesterday". */
  caption?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/** A KPI number for dashboards and the student home. */
export function StatTile({ label, value, caption, icon, className }: StatTileProps) {
  return (
    <div className={cn("rounded-card border border-line bg-surface-raised p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-label text-ink-muted">{label}</p>
        {icon ? (
          <span aria-hidden="true" className="inline-flex text-teal [&_svg]:size-5">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-numeric text-ink-strong">{value}</p>
      {caption ? <p className="mt-1 text-caption text-ink-muted">{caption}</p> : null}
    </div>
  );
}
