import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface CardProps extends HTMLAttributes<HTMLElement> {
  /** "raised" adds the one soft shadow; use it for the key card on a screen only. */
  elevation?: "flat" | "raised";
  as?: "section" | "article" | "div";
}

export function Card({ elevation = "flat", as: Tag = "section", className, ...props }: CardProps) {
  return (
    <Tag
      className={cn(
        "rounded-card border border-line bg-surface-raised",
        elevation === "raised" && "border-transparent shadow-card",
        className,
      )}
      {...props}
    />
  );
}

interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Buttons or links at the end of the header. */
  actions?: ReactNode;
  className?: string;
  /** Heading level for the title; defaults to h2. */
  headingLevel?: 2 | 3;
}

export function CardHeader({
  title,
  description,
  actions,
  className,
  headingLevel = 2,
}: CardHeaderProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 p-4 pb-0 sm:p-5 sm:pb-0",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <Heading className="text-h3 text-ink-strong">{title}</Heading>
        {description ? <p className="mt-0.5 text-body-sm text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 sm:p-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-2 border-t border-line p-4 sm:px-5",
        className,
      )}
      {...props}
    />
  );
}
