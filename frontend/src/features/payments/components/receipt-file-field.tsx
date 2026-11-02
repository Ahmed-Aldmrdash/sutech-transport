"use client";

import { FileCheck2, Upload } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { Locale } from "@/i18n/routing";
import { formatFileSize } from "@/lib/format";
import { RECEIPT_CONTENT_TYPES } from "../schema";

interface ReceiptFileFieldProps {
  file: File | null;
  maxBytes: number;
  error?: string;
  onChange: (file: File | null) => void;
}

/** Picks the receipt photo or PDF; on phones it also offers the camera. */
export function ReceiptFileField({ file, maxBytes, error, onChange }: ReceiptFileFieldProps) {
  const t = useTranslations("student.payment.receipt");
  const locale = useLocale() as Locale;
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Field
      label={t("file")}
      hint={t("fileHint", { size: formatFileSize(maxBytes, locale) })}
      error={error}
      required
    >
      {(control) => (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-line-strong p-3">
          <input
            ref={inputRef}
            {...control}
            type="file"
            accept={RECEIPT_CONTENT_TYPES.join(",")}
            className="sr-only"
            onChange={(event) => onChange(event.target.files?.[0] ?? null)}
          />
          {file ? (
            <span className="flex min-w-0 flex-1 items-center gap-2 text-body-sm text-ink-strong">
              <FileCheck2 aria-hidden="true" className="size-5 shrink-0 text-success" />
              <span className="truncate" dir="ltr">
                {file.name}
              </span>
              <span className="shrink-0 text-ink-muted">({formatFileSize(file.size, locale)})</span>
            </span>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            iconStart={<Upload className="size-4" />}
            onClick={() => inputRef.current?.click()}
          >
            {file ? t("changeFile") : t("chooseFile")}
          </Button>
        </div>
      )}
    </Field>
  );
}
