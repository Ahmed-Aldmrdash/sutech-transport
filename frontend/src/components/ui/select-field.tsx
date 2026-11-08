"use client";

import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { Field, controlStyles } from "./field";
import { type FieldOwnProps } from "./input";

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectFieldProps
  extends
    FieldOwnProps,
    Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "required" | "children"> {
  options: readonly SelectOption[];
  /** First, empty choice such as "Choose a line". */
  placeholder?: string;
  containerClassName?: string;
}

/** Native select: best on phones (system picker) and fully accessible. */
export function SelectField({
  label,
  hint,
  error,
  required,
  optionalText,
  options,
  placeholder,
  className,
  containerClassName,
  ...selectProps
}: SelectFieldProps) {
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      optionalText={optionalText}
      className={containerClassName}
    >
      {(control) => (
        <div className="relative">
          <select
            {...control}
            {...selectProps}
            className={cn(controlStyles, "h-12 appearance-none ps-3 pe-10", className)}
          >
            {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 end-3 my-auto size-5 text-ink-muted"
          />
        </div>
      )}
    </Field>
  );
}
