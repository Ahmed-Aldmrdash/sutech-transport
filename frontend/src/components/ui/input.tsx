"use client";

import type { InputHTMLAttributes, ReactNode, Ref, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Field, controlStyles, type FieldProps } from "./field";

export type FieldOwnProps = Omit<FieldProps, "children" | "className">;

interface TextFieldProps
  extends FieldOwnProps, Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "required"> {
  /** Icon inside the control at the start edge (right in Arabic). */
  icon?: ReactNode;
  containerClassName?: string;
  ref?: Ref<HTMLInputElement>;
}

export function TextField({
  label,
  hint,
  error,
  required,
  optionalText,
  icon,
  className,
  containerClassName,
  ref,
  ...inputProps
}: TextFieldProps) {
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
        // The icon follows the input's own direction (an LTR phone number in an Arabic form
        // keeps its icon and padding on the same side as the text starts).
        <div className="relative" dir={inputProps.dir}>
          {icon ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-ink-muted [&_svg]:size-5"
            >
              {icon}
            </span>
          ) : null}
          <input
            ref={ref}
            {...control}
            {...inputProps}
            className={cn(controlStyles, "h-12 px-3", icon ? "ps-10" : null, className)}
          />
        </div>
      )}
    </Field>
  );
}

interface TextAreaFieldProps
  extends FieldOwnProps, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "required"> {
  containerClassName?: string;
}

export function TextAreaField({
  label,
  hint,
  error,
  required,
  optionalText,
  className,
  containerClassName,
  rows = 4,
  ...textareaProps
}: TextAreaFieldProps) {
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
        <textarea
          {...control}
          {...textareaProps}
          rows={rows}
          className={cn(controlStyles, "min-h-24 px-3 py-2.5", className)}
        />
      )}
    </Field>
  );
}
