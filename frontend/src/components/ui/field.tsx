"use client";

import { CircleAlert } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface FieldProps {
  label: string;
  /** Short help under the control. Hidden while an error is shown. */
  hint?: string;
  /** What went wrong and how to fix it. Turns the control red and is announced. */
  error?: string;
  required?: boolean;
  /** Shown after the label for optional fields, e.g. "(optional)". */
  optionalText?: string;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/** Props the field hands to its control so label, hint and error are wired for screen readers. */
export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  required?: boolean;
}

/** Label + control + hint/error, laid out the same way for every input. */
export function Field({
  label,
  hint,
  error,
  required,
  optionalText,
  className,
  children,
}: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-body-sm font-bold text-ink-strong">
        {label}
        {!required && optionalText ? (
          <span className="ms-1 font-normal text-ink-muted">{optionalText}</span>
        ) : null}
      </label>
      {children({
        id,
        "aria-describedby": message ? messageId : undefined,
        "aria-invalid": error ? true : undefined,
        required,
      })}
      {message ? (
        <p
          id={messageId}
          role={error ? "alert" : undefined}
          className={cn(
            "flex items-start gap-1.5 text-body-sm",
            error ? "text-danger" : "text-ink-muted",
          )}
        >
          {error ? <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : null}
          {message}
        </p>
      ) : null}
    </div>
  );
}

export const controlStyles = cn(
  "w-full rounded-md border border-line-strong bg-surface-raised text-ink-strong shadow-sm focus-ring",
  "transition-colors duration-150 placeholder:text-ink-muted",
  "hover:border-ink-muted disabled:cursor-not-allowed disabled:bg-surface-alt disabled:text-ink-muted",
  "aria-invalid:border-danger aria-invalid:focus-visible:outline-danger",
);
