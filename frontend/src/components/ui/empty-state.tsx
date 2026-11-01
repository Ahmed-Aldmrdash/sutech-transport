import type { ReactNode } from "react";
import { BrandPattern } from "@/components/brand/brand-pattern";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Shows the logo's three-shape pattern behind the content, as the brand book asks. */
  withPattern?: boolean;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  withPattern = true,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative isolate flex flex-col items-center overflow-hidden rounded-card bg-surface-alt px-6 py-10 text-center",
        className,
      )}
    >
      {withPattern ? <BrandPattern className="-z-10 opacity-60" tone="brand" /> : null}
      {icon ? (
        <span
          aria-hidden="true"
          className="mb-4 inline-flex size-14 items-center justify-center rounded-card bg-brand-soft text-brand [&_svg]:size-7"
        >
          {icon}
        </span>
      ) : null}
      <h2 className="text-h3 text-ink-strong">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-md text-body-sm text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
