import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Small uppercase line above the title, e.g. the section name. */
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** The one h1 of every screen. */
export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1 text-label text-teal-text">{eyebrow}</p> : null}
        <h1 className="text-h1 text-ink-strong">{title}</h1>
        {description ? <p className="mt-1 text-body text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
