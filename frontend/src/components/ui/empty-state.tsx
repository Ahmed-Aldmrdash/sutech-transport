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
  /** 1 when the state is the whole page (nothing else gives the page its heading). */
  headingLevel?: 1 | 2;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  withPattern = true,
  headingLevel = 2,
  className,
}: EmptyStateProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
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
      <Heading className="text-h3 text-ink-strong">{title}</Heading>
      {description ? (
        <p className="mt-1 max-w-md text-body-sm text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
