import { ChevronRight } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export function List({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      className={cn(
        "divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-raised",
        className,
      )}
      {...props}
    />
  );
}

interface ListItemProps {
  title: ReactNode;
  description?: ReactNode;
  /** Icon tile at the start edge. */
  icon?: ReactNode;
  /** Badge, value or button at the end edge. */
  trailing?: ReactNode;
  /** Makes the whole row a link, with a chevron that flips in RTL. */
  href?: ComponentProps<typeof Link>["href"];
  className?: string;
}

export function ListItem({ title, description, icon, trailing, href, className }: ListItemProps) {
  const content = (
    <>
      {icon ? (
        <span
          aria-hidden="true"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm bg-brand-soft text-brand [&_svg]:size-5"
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-bold text-ink-strong">{title}</span>
        {description ? (
          <span className="block text-body-sm text-ink-muted">{description}</span>
        ) : null}
      </span>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
      {href ? (
        <ChevronRight
          aria-hidden="true"
          className="size-5 shrink-0 text-ink-muted rtl:-scale-x-100"
        />
      ) : null}
    </>
  );
  const rowStyles = "flex min-h-16 items-center gap-3 px-4 py-3";

  return (
    <li className={className}>
      {href ? (
        <Link
          href={href}
          className={cn(rowStyles, "focus-ring transition-colors hover:bg-surface-alt")}
        >
          {content}
        </Link>
      ) : (
        <div className={rowStyles}>{content}</div>
      )}
    </li>
  );
}
