import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import { cn } from "@/lib/cn";

type BannerTone = "info" | "success" | "warning" | "danger";

const STYLE: Record<BannerTone, { box: string; icon: ReactNode }> = {
  info: { box: "bg-teal-soft text-teal-text", icon: <Info className="size-5 shrink-0" aria-hidden /> },
  success: { box: "bg-success-soft text-success-text", icon: <CheckCircle2 className="size-5 shrink-0" aria-hidden /> },
  warning: { box: "bg-warning-soft text-warning-text", icon: <AlertTriangle className="size-5 shrink-0" aria-hidden /> },
  danger: { box: "bg-danger-soft text-danger", icon: <OctagonAlert className="size-5 shrink-0" aria-hidden /> },
};

export function Banner({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: BannerTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const style = STYLE[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-md p-3 text-[15px] leading-6", style.box, className)}>
      {style.icon}
      <div className="min-w-0 flex-1">
        {title && <p className="font-bold">{title}</p>}
        {children && <div>{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}
