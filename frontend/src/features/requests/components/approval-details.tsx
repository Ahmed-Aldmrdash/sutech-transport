"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/routing";
import { formatCalendarDate } from "@/lib/format";
import type { LineChangeRequest } from "../schema";

/** What the student asked for: from which line to which, for how long, and why. */
export function ApprovalDetails({
  details,
  name,
}: {
  details: LineChangeRequest["details"];
  name: string;
}) {
  const t = useTranslations("parent.approvals");
  const tStudent = useTranslations("student");
  const locale = useLocale() as Locale;
  const lineLabel = (line: { code: string; name: string }) =>
    `${tStudent("lineCode", { code: line.code })} · ${line.name}`;
  const day = (value: string) => formatCalendarDate(value, locale);
  return (
    <dl className="flex flex-col divide-y divide-line">
      <Row label={t("from")}>{lineLabel(details.from_line)}</Row>
      <Row label={t("to")}>
        {lineLabel(details.to_line)}
        <span className="block font-normal text-ink">
          {t("stop", { stop: details.to_stop.name })}
        </span>
      </Row>
      <Row label={t("duration")}>
        {details.ends_on
          ? tStudent("requests.lineChange.temporaryRange", {
              from: day(details.starts_on),
              to: day(details.ends_on),
            })
          : tStudent("requests.lineChange.permanentFrom", { from: day(details.starts_on) })}
      </Row>
      <Row label={t("reason", { name })}>{details.reason}</Row>
    </dl>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:gap-4">
      <dt className="text-body-sm text-ink-muted sm:w-40 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 text-body-sm font-bold break-words text-ink-strong">{children}</dd>
    </div>
  );
}
