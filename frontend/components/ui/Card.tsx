import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "section" | "div" | "article";
  raised?: boolean;
}

export function Card({ as: Tag = "section", raised = false, className, ...rest }: CardProps) {
  return (
    <Tag
      className={cn(
        "rounded-card border border-line bg-surface-raised p-4",
        raised && "border-transparent shadow-card",
        className,
      )}
      {...rest}
    />
  );
}

export function CardTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h3 className="text-[18px] leading-[26px] font-bold">{children}</h3>
      {action}
    </div>
  );
}
