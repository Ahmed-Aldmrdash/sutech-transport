import { cn } from "@/lib/cn";

const MAX_SHOWN = 9;

/** Small brand-colour count on a bell or menu item ("3", "9+"). Decorative: the label says the count. */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-brand px-1 text-[11px] leading-none font-bold text-on-brand ring-2 ring-surface-raised",
        className,
      )}
    >
      {count > MAX_SHOWN ? `${MAX_SHOWN}+` : count}
    </span>
  );
}
