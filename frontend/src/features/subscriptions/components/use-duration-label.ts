"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;

/** "23 h 10 min" / "23 ساعة و10 دقيقة" for countdowns; rounds up so it never shows 0 early. */
export function useDurationLabel(): (milliseconds: number) => string {
  const t = useTranslations("student.duration");
  return useCallback(
    (milliseconds: number) => {
      const totalMinutes = Math.max(0, Math.ceil(milliseconds / MS_PER_MINUTE));
      const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
      const minutes = totalMinutes % MINUTES_PER_HOUR;
      if (hours === 0) return t("minutes", { minutes });
      return minutes === 0 ? t("hours", { hours }) : t("hoursMinutes", { hours, minutes });
    },
    [t],
  );
}
