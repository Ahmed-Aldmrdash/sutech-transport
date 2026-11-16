"use client";

import { useLocale, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Tone } from "@/components/ui/tone";
import type { Locale } from "@/i18n/routing";
import { formatCalendarDate } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { getMyStanding } from "../api";
import { DisciplineAction, Standing } from "../schema";

const ACTION_OF: Partial<Record<Standing, DisciplineAction>> = {
  [Standing.Warned]: DisciplineAction.Warning,
  [Standing.Suspended]: DisciplineAction.Suspension,
  [Standing.Banned]: DisciplineAction.Ban,
};

/**
 * Tells the student, on their home page, when the Transportation office warned, suspended or
 * banned them, and why. Shows nothing in good standing (or if the check fails).
 */
export function MyStandingAlert() {
  const t = useTranslations("discipline.student");
  const locale = useLocale() as Locale;
  const state = useAsync((signal) => getMyStanding({ signal }), []);
  if (state.status !== AsyncStatus.Success) return null;
  const { standing, suspended_until: until, records } = state.data;
  const action = ACTION_OF[standing];
  if (!action) return null;
  const record = records.find((item) => item.in_force && item.action === action);
  const title =
    standing === Standing.Banned
      ? t("bannedTitle")
      : standing === Standing.Suspended && until
        ? t("suspendedTitle", { day: formatCalendarDate(until, locale) })
        : t("warnedTitle");
  return (
    <Alert tone={standing === Standing.Warned ? Tone.Warning : Tone.Danger} title={title}>
      {record ? <p>{t("reason", { reason: record.reason })}</p> : null}
      <p>{t("contact")}</p>
    </Alert>
  );
}
