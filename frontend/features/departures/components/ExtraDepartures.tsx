"use client";

import { CalendarClock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { useErrorMessage } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useApi, useMutation } from "@/lib/api/use-api";
import { formatClock } from "@/lib/time";
import { joinDeparture, leaveDeparture, listDepartures } from "../api";

/** Extra return trips today on the student's line; the student joins one to get a seat. */
export function ExtraDepartures() {
  const t = useTranslations("student.departures");
  const locale = useLocale();
  const toast = useToast();
  const query = useApi(listDepartures);
  const join = useMutation(joinDeparture);
  const leave = useMutation(leaveDeparture);
  const error = useErrorMessage(join.error ?? leave.error);
  const items = query.data ?? [];
  if (!items.length) return null;
  return (
    <Card>
      <CardTitle>{t("title")}</CardTitle>
      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const full = item.booked >= item.capacity;
          return (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-alt p-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-bold text-ink-strong">
                  <CalendarClock className="size-4 text-teal" aria-hidden />
                  <span className="num">{formatClock(item.time, locale)}</span>
                  {item.joined && <Pill tone="success">{t("joined")}</Pill>}
                </p>
                <p className="text-[14px] text-ink-muted">{item.reason}</p>
                <p className="num text-[13px] text-ink-muted">{t("seats", { booked: item.booked, capacity: item.capacity })}</p>
              </div>
              {item.joined ? (
                <Button size="sm" variant="ghost" loading={leave.pending} onClick={async () => (await leave.run(item.id)) && toast(t("left"))}>
                  {t("leave")}
                </Button>
              ) : (
                <Button size="sm" variant="teal" disabled={full} loading={join.pending} onClick={async () => (await join.run(item.id)) && toast(t("joinedToast"))}>
                  {full ? t("full") : t("join")}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-2 text-[14px] font-bold text-danger">{error}</p>}
    </Card>
  );
}
