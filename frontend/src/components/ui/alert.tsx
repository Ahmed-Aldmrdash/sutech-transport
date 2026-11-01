import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Tone } from "./tone";

type AlertTone = typeof Tone.Info | typeof Tone.Success | typeof Tone.Warning | typeof Tone.Danger;

const ALERT_STYLES: Record<AlertTone, { box: string; icon: ReactNode }> = {
  info: { box: "bg-teal-soft text-teal-text", icon: <Info /> },
  success: { box: "bg-success-soft text-success-text", icon: <CircleCheck /> },
  warning: { box: "bg-warning-soft text-warning-text", icon: <TriangleAlert /> },
  danger: { box: "bg-danger-soft text-danger", icon: <CircleAlert /> },
};

interface AlertProps {
  tone?: AlertTone;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** An inline banner: delays, payment notes, form errors. Danger alerts are announced. */
export function Alert({ tone = Tone.Info, title, children, action, className }: AlertProps) {
  const style = ALERT_STYLES[tone];
  return (
    <div
      role={tone === Tone.Danger ? "alert" : "status"}
      className={cn("flex flex-wrap items-start gap-3 rounded-md p-4", style.box, className)}
    >
      <span aria-hidden="true" className="mt-0.5 inline-flex shrink-0 [&_svg]:size-5">
        {style.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-bold">{title}</p>
        {children ? <div className="mt-0.5 text-body-sm text-ink">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
