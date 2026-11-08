"use client";

import { Check } from "lucide-react";
import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface ChoiceProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id"> {
  label: ReactNode;
  description?: ReactNode;
}

function ChoiceText({
  id,
  label,
  description,
}: {
  id: string;
  label: ReactNode;
  description?: ReactNode;
}) {
  return (
    <span className="flex flex-col">
      <label htmlFor={id} className="cursor-pointer text-body text-ink-strong">
        {label}
      </label>
      {description ? <span className="text-body-sm text-ink-muted">{description}</span> : null}
    </span>
  );
}

export function Checkbox({ label, description, className, ...props }: ChoiceProps) {
  const id = useId();
  return (
    <div className={cn("flex min-h-tap items-center gap-3", className)}>
      <span className="relative inline-flex size-5 shrink-0">
        <input
          id={id}
          type="checkbox"
          className="peer size-5 cursor-pointer appearance-none rounded-sm border-2 border-line-strong bg-surface-raised focus-ring transition-colors checked:border-brand checked:bg-brand disabled:cursor-not-allowed disabled:opacity-50"
          {...props}
        />
        {/* A 48px tap area around the 20px box (a label, so a tap there ticks it). */}
        <label htmlFor={id} aria-hidden="true" className="absolute -inset-3.5" />
        <Check
          aria-hidden="true"
          strokeWidth={3}
          className="pointer-events-none absolute inset-0.5 size-4 text-on-brand opacity-0 peer-checked:opacity-100"
        />
      </span>
      <ChoiceText id={id} label={label} description={description} />
    </div>
  );
}

export function Radio({ label, description, className, ...props }: ChoiceProps) {
  const id = useId();
  return (
    <div className={cn("flex min-h-tap items-center gap-3", className)}>
      <span className="relative inline-flex size-5 shrink-0">
        <input
          id={id}
          type="radio"
          className="size-5 cursor-pointer appearance-none rounded-full border-2 border-line-strong bg-surface-raised focus-ring transition-colors checked:border-[6px] checked:border-brand disabled:cursor-not-allowed disabled:opacity-50"
          {...props}
        />
        <label htmlFor={id} aria-hidden="true" className="absolute -inset-3.5" />
      </span>
      <ChoiceText id={id} label={label} description={description} />
    </div>
  );
}

/** An on/off setting that applies at once (no Save button). */
export function Switch({ label, description, className, ...props }: ChoiceProps) {
  const id = useId();
  return (
    <div className={cn("flex min-h-tap items-center justify-between gap-4", className)}>
      <ChoiceText id={id} label={label} description={description} />
      <span className="relative inline-flex h-7 w-12 shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="peer absolute inset-0 cursor-pointer appearance-none rounded-pill bg-line-strong focus-ring transition-colors checked:bg-brand disabled:cursor-not-allowed disabled:opacity-50"
          {...props}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute start-1 top-1 size-5 rounded-full bg-surface-raised shadow-sm transition-transform duration-150 peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5"
        />
      </span>
    </div>
  );
}
