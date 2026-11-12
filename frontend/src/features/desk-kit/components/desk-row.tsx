"use client";

import { ChevronRight } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/** One item of an office queue: icon, title and badge, two lines of facts, a link to it. */
export function DeskRow({
  href,
  icon,
  title,
  badge,
  lines,
  highlight = false,
  muted = false,
}: {
  href: ComponentProps<typeof Link>["href"];
  icon: ReactNode;
  title: ReactNode;
  badge?: ReactNode;
  lines: ReactNode[];
  /** Waiting for this office: drawn with the brand border. */
  highlight?: boolean;
  /** Done: a grey icon. */
  muted?: boolean;
}) {
  return (
    <Card className={cn(highlight && "border-brand")}>
      <Link
        href={href}
        className="flex items-center gap-4 rounded-card p-4 focus-ring hover:bg-surface-alt"
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full [&_svg]:size-5",
            muted ? "bg-surface-alt text-ink-muted" : "bg-brand-soft text-brand",
          )}
        >
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-body font-bold text-ink-strong">{title}</p>
            {badge}
          </div>
          {lines.map((line, index) => (
            <p
              key={index}
              className={index === 0 ? "text-body-sm text-ink" : "text-caption text-ink-muted"}
            >
              {line}
            </p>
          ))}
        </div>
        <ChevronRight
          aria-hidden="true"
          className="size-5 shrink-0 text-ink-muted rtl:-scale-x-100"
        />
      </Link>
    </Card>
  );
}
