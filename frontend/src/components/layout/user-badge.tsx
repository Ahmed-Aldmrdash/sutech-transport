import { cn } from "@/lib/cn";

export interface ShellUser {
  name: string;
  /** Translated role name shown under the name. */
  roleLabel: string;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function UserBadge({
  user,
  compact = false,
  className,
}: {
  user: ShellUser;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-3", className)}>
      <span
        aria-hidden="true"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-body-sm font-bold text-on-brand"
      >
        {initials(user.name)}
      </span>
      {compact ? (
        <span className="sr-only">{user.name}</span>
      ) : (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body-sm font-bold text-ink-strong">{user.name}</span>
          <span className="truncate text-caption text-ink-muted">{user.roleLabel}</span>
        </span>
      )}
    </span>
  );
}
