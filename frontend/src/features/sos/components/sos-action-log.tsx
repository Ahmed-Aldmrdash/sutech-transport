"use client";

import {
  Ambulance,
  BusFront,
  CircleCheck,
  Hand,
  MessageSquareText,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { formatTime } from "@/lib/format";
import { SosAction, type SosActionEntry } from "../schema";

const ACTION_ICON: Record<SosAction, LucideIcon> = {
  [SosAction.Acknowledge]: Hand,
  [SosAction.AmbulanceCalled]: Ambulance,
  [SosAction.ReplacementSent]: BusFront,
  [SosAction.Note]: MessageSquareText,
  [SosAction.Close]: CircleCheck,
};

/** What the office did on an alert, oldest first: the crew and the office read the same log. */
export function SosActionLog({ actions }: { actions: readonly SosActionEntry[] }) {
  const t = useTranslations("sos.log");
  const locale = useLocale() as Locale;
  if (actions.length === 0) {
    return <p className="text-body-sm text-ink-muted">{t("empty")}</p>;
  }
  return (
    <ol className="flex flex-col gap-3">
      {actions.map((entry, index) => {
        const Icon = ACTION_ICON[entry.action];
        return (
          <li key={`${entry.at}-${index}`} className="flex gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-soft text-teal">
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-body-sm font-bold text-ink-strong">
                {t(`actions.${entry.action}`)}
              </p>
              <p className="text-caption text-ink-muted">
                {t("by", { name: entry.by_name ?? "", time: formatTime(entry.at, locale) })}
              </p>
              {entry.note ? <p className="mt-1 text-body-sm text-ink">{entry.note}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
