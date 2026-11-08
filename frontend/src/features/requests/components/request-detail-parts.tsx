"use client";

import { Paperclip } from "lucide-react";
import { useLocale } from "next-intl";
import { type ReactNode } from "react";
import type { Locale } from "@/i18n/routing";
import { formatFileSize } from "@/lib/format";
import { type Attachment } from "../schema";

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:gap-4">
      <dt className="text-body-sm text-ink-muted sm:w-40 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 text-body-sm font-bold break-words text-ink-strong">{children}</dd>
    </div>
  );
}

export function Attachments({ items }: { items: readonly Attachment[] }) {
  const locale = useLocale() as Locale;
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.attachment_id} className="flex items-center gap-2 font-normal">
          <Paperclip aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
          <span className="truncate" dir="ltr">
            {item.file_name}
          </span>
          <span className="shrink-0 text-ink-muted">
            ({formatFileSize(item.size_bytes, locale)})
          </span>
        </li>
      ))}
    </ul>
  );
}
