import { cn } from "@/lib/cn";

interface FilterChipsProps<T extends string> {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** A row of toggle buttons that filter a list ("All", "Unread"). Exactly one is pressed. */
export function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: FilterChipsProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex h-10 items-center rounded-pill border px-4 text-body-sm font-bold focus-ring transition-colors",
            value === option.value
              ? "border-brand bg-brand text-on-brand"
              : "border-line-strong text-ink hover:bg-surface-alt",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
