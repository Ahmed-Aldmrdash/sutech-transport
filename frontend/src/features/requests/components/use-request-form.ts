"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { FieldErrors, RequestFieldError } from "../request-validation";

/**
 * The state every request form keeps: the typed values, the errors found on submit, and the
 * message for each field. Changing a field clears its error.
 */
export function useRequestForm<V extends object>(initial: V | (() => V)) {
  type Key = Extract<keyof V, string>;
  const tForm = useTranslations("student.requests");
  const [values, setValues] = useState<V>(initial);
  const [errors, setErrors] = useState<FieldErrors<Key>>({});

  function update<K extends Key>(key: K, value: V[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }
  function fieldError(key: Key): string | undefined {
    const error: RequestFieldError | undefined = errors[key];
    return error ? tForm(`errors.${error}`) : undefined;
  }
  return { values, errors, setErrors, update, fieldError };
}
