import { cn } from "@/lib/cn";

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-12 w-full items-center justify-between gap-4 text-start"
    >
      <span className="min-w-0">
        <span className="block font-bold text-ink-strong">{label}</span>
        {description && <span className="block text-[14px] leading-5 text-ink-muted">{description}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors duration-150",
          checked ? "bg-brand" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-1 size-5 rounded-full bg-surface-raised shadow-sm transition-all duration-150",
            checked ? "start-6" : "start-1",
          )}
        />
      </span>
    </button>
  );
}
