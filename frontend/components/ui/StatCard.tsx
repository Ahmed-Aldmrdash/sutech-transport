import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function StatCard({ label, value, hint, icon, tone = "brand" }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: "brand" | "teal" | "warning" | "danger" | "success" }) {
  return (
    <div className="flex items-start gap-3 rounded-card border border-line bg-surface-raised p-4">
      {icon && (
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-md",
            tone === "brand" && "bg-brand-soft text-brand",
            tone === "teal" && "bg-teal-soft text-teal-text",
            tone === "warning" && "bg-warning-soft text-warning-text",
            tone === "danger" && "bg-danger-soft text-danger",
            tone === "success" && "bg-success-soft text-success-text",
          )}
        >
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[13px] text-ink-muted">{label}</p>
        <p className="num text-[24px] leading-8 font-extrabold text-ink-strong">{value}</p>
        {hint && <p className="text-[13px] text-ink-muted">{hint}</p>}
      </div>
    </div>
  );
}
