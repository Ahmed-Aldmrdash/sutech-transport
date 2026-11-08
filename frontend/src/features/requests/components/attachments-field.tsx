"use client";

import { FileCheck2, FileX2, Paperclip, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { RECEIPT_CONTENT_TYPES } from "@/features/payments/schema";
import type { Locale } from "@/i18n/routing";
import { formatFileSize } from "@/lib/format";
import { MAX_ATTACHMENTS } from "../schema";
import { checkPicked } from "./attachment-rules";

interface AttachmentsFieldProps {
  label: string;
  hint: string;
  files: readonly File[];
  /** The largest file accepted, in bytes. */
  maxBytes: number;
  required?: boolean;
  error?: string;
  onChange: (files: File[]) => void;
}

type RejectReason = "fileType" | "fileTooLarge" | "tooManyFiles";

export interface Rejected {
  name: string;
  reason: RejectReason;
}

/**
 * Up to three photos or PDFs (documents, evidence); on phones it also offers the camera. Each
 * file is checked the moment it is picked: a wrong type, a file too big or one too many is
 * refused there, with the reason next to its name, instead of failing at Submit.
 */
export function AttachmentsField({
  label,
  hint,
  files,
  maxBytes,
  required,
  error,
  onChange,
}: AttachmentsFieldProps) {
  const t = useTranslations("student.requests.attachments");
  const tErrors = useTranslations("student.requests.errors");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const inputRef = useRef<HTMLInputElement>(null);
  const [rejected, setRejected] = useState<Rejected[]>([]);
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
              const picked = checkPicked(files, Array.from(event.target.files ?? []), maxBytes);
              setRejected(picked.rejected);
              if (picked.kept.length > 0) onChange([...files, ...picked.kept]);
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
          {rejected.length > 0 ? (
            <ul role="alert" className="flex flex-col gap-1">
              {rejected.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex min-w-0 items-start gap-2 text-body-sm text-danger-text"
                >
                  <FileX2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate font-bold" dir="ltr">
                      {file.name}
                    </span>
                    {t("refused", {
                      reason: tErrors(file.reason, { size: formatFileSize(maxBytes, locale) }),
                    })}
                  </span>
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
