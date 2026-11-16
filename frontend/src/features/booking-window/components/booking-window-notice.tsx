"use client";

import { useLocale, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Tone } from "@/components/ui/tone";
import type { Locale } from "@/i18n/routing";
import { formatDateTime } from "@/lib/format";
import { BookingWindowStatus, type BookingWindow } from "../schema";

/**
 * Tells the student whether booking is open and until when. Shown on the lines page and in
 * place of the "Book" button while booking is closed.
 */
export function BookingWindowNotice({ window }: { window: BookingWindow }) {
  const t = useTranslations("bookingWindow.student");
  const locale = useLocale() as Locale;
  const when = (value: string | null) => (value ? formatDateTime(value, locale) : "");

  if (window.status === BookingWindowStatus.Open) {
    return (
      <Alert tone={Tone.Info} title={t("openTitle")}>
        {t("openBody", { until: when(window.closes_at) })}
      </Alert>
    );
  }
  if (window.status === BookingWindowStatus.NotOpen && window.opens_at) {
    return (
      <Alert tone={Tone.Warning} title={t("soonTitle")}>
        {t("soonBody", { from: when(window.opens_at) })}
      </Alert>
    );
  }
  return (
    <Alert tone={Tone.Warning} title={t("closedTitle")}>
      {t("closedBody")}
    </Alert>
  );
}
