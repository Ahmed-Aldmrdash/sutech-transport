"use client";

import { Camera, FileCheck2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import type { Locale } from "@/i18n/routing";
import { formatFileSize } from "@/lib/format";
import { VIOLATION_PHOTO_TYPES } from "../schema";

/** The photo the report needs, straight from the phone's camera. */
export function PhotoField({
  photo,
  error,
  onChange,
}: {
  photo: File | null;
  error: string | undefined;
  onChange: (photo: File | null) => void;
}) {
  const t = useTranslations("violations");
  const locale = useLocale() as Locale;
  const photoRef = useRef<HTMLInputElement>(null);
  return (
    <Field label={t("photo")} hint={t("photoHint")} required error={error}>
      {(control) => (
        <div className="flex flex-col gap-2 rounded-md border border-dashed border-line-strong p-3">
          <input
            ref={photoRef}
            {...control}
            type="file"
            accept={VIOLATION_PHOTO_TYPES.join(",")}
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              onChange(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
          {photo ? (
            <p className="flex min-w-0 items-center gap-2 text-body-sm text-ink-strong">
              <FileCheck2 aria-hidden="true" className="size-5 shrink-0 text-success" />
              <span className="truncate" dir="ltr">
                {photo.name}
              </span>
              <span className="shrink-0 text-ink-muted">
                ({formatFileSize(photo.size, locale)})
              </span>
              <IconButton
                size="sm"
                variant="ghost"
                className="ms-auto"
                icon={<X />}
                label={t("removePhoto")}
                onClick={() => onChange(null)}
              />
            </p>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            iconStart={<Camera className="size-4" />}
            onClick={() => photoRef.current?.click()}
          >
            {photo ? t("retakePhoto") : t("takePhoto")}
          </Button>
        </div>
      )}
    </Field>
  );
}
