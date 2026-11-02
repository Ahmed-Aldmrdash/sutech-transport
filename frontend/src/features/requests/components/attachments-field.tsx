"use client";

import { FileCheck2, Paperclip, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { RECEIPT_CONTENT_TYPES } from "@/features/payments/schema";
import type { Locale } from "@/i18n/routing";
import { formatFileSize } from "@/lib/format";
import { MAX_ATTACHMENTS } from "../schema";

interface AttachmentsFieldProps {
  label: string;
  hint: string;
  files: readonly File[];
  required?: boolean;
  error?: string;
  onChange: (files: File[]) => void;
}

/** Up to three photos or PDFs (documents, evidence); on phones it also offers the camera. */
export function AttachmentsField({
  label,
  hint,
  files,
  required,
  error,
  onChange,
}: AttachmentsFieldProps) {
  const t = useTranslations("student.requests.attachments");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const inputRef = useRef<HTMLInputElement>(null);
  const isFull = files.length >= MAX_ATTACHMENTS;

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      optionalText={tCommon("optional")}
    >
      {(control) => (
        <div className="flex flex-col gap-2 rounded-md border border-dashed border-line-strong p-3">
          <input
            ref={inputRef}
            {...control}
            type="file"
            multiple
            accept={RECEIPT_CONTENT_TYPES.join(",")}
            className="sr-only"
            onChange={(event) => {
              const picked = Array.from(event.target.files ?? []);
              onChange([...files, ...picked]);
              event.target.value = "";
            }}
          />
          {files.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {files.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex min-w-0 items-center gap-2 text-body-sm text-ink-strong"
                >
                  <FileCheck2 aria-hidden="true" className="size-5 shrink-0 text-success" />
                  <span className="truncate" dir="ltr">
                    {file.name}
                  </span>
                  <span className="shrink-0 text-ink-muted">
                    ({formatFileSize(file.size, locale)})
                  </span>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    className="ms-auto"
                    icon={<X />}
                    label={t("remove", { name: file.name })}
                    onClick={() => onChange(files.filter((_, at) => at !== index))}
                  />
                </li>
              ))}
            </ul>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            disabled={isFull}
            iconStart={<Paperclip className="size-4" />}
            onClick={() => inputRef.current?.click()}
          >
            {isFull ? t("full", { count: MAX_ATTACHMENTS }) : t("add")}
          </Button>
        </div>
      )}
    </Field>
  );
}
