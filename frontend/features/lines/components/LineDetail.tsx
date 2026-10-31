"use client";

import { useState } from "react";
import { Bus, User } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Async } from "@/components/ui/Async";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useErrorMessage } from "@/components/ui/States";
import { getMySubscription, reserveSeat } from "@/features/subscriptions/api";
import { holdsSeat } from "@/features/subscriptions/schema";
import { getTerm } from "@/features/term/api";
import { useRouter } from "@/i18n/navigation";
import { combineQueries, useApi, useMutation } from "@/lib/api/use-api";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { formatClock } from "@/lib/time";
import { getLine } from "../api";

/** One line: its stops and times; the student picks a stop and reserves a seat (held 24 hours, price fixed). */
export function LineDetail({ lineId }: { lineId: string }) {
  const t = useTranslations("student.lines");
  const locale = useLocale();
  const router = useRouter();
  const line = useApi(() => getLine(lineId), [lineId]);
  const context = combineQueries(useApi(getMySubscription), useApi(getTerm));
  const query = combineQueries(line, context);
  const [stopId, setStopId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const reserve = useMutation(reserveSeat);
  const error = useErrorMessage(reserve.error);

  return (
    <Async query={query}>
      {([data, [subscription, term]]) => {
        const held = holdsSeat(subscription);
        const closed = term.current.booking !== "open";
        const full = data.seats_left === 0;
        const stop = data.stops.find((item) => item.id === stopId);
        return (
          <>
            <PageHeader title={data.name} subtitle={formatMoney(data.price, locale)} back="/student/lines" backLabel={t("back")} />
            <div className="flex flex-col gap-4">
              <Card className="grid grid-cols-2 gap-3 text-[14px]">
                <p className="flex items-center gap-1.5">
                  <Bus className="size-4 text-ink-muted" aria-hidden />
                  <bdi>{data.bus_plate ?? "—"}</bdi>
                </p>
                <p className="flex items-center gap-1.5">
                  <User className="size-4 text-ink-muted" aria-hidden />
                  {data.driver_name ?? "—"}
                </p>
                <p className="col-span-2 text-ink-muted">{t("seatsOf", { left: data.seats_left, capacity: data.capacity })}</p>
              </Card>
              <Card>
                <CardTitle>{t("pickStop")}</CardTitle>
                <fieldset className="flex flex-col gap-1" disabled={held || closed || full}>
                  <legend className="sr-only">{t("pickStop")}</legend>
                  {data.stops.map((item) => {
                    const bookable = item.active && !item.is_destination;
                    return (
                      <label
                        key={item.id}
                        className={cn(
                          "flex min-h-12 items-center justify-between gap-3 rounded-md border px-3",
                          stopId === item.id ? "border-brand bg-brand-soft" : "border-transparent",
                          bookable ? "cursor-pointer" : "opacity-60",
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <input type="radio" name="stop" value={item.id} checked={stopId === item.id} disabled={!bookable} onChange={() => setStopId(item.id)} className="size-5 accent-[var(--brand)]" />
                          <span>
                            {item.name}
                            {item.is_destination && <span className="block text-[13px] text-ink-muted">{t("destination")}</span>}
                            {!item.active && <span className="block text-[13px] text-ink-muted">{t("stopPaused")}</span>}
                          </span>
                        </span>
                        <span className="num text-[14px] text-ink-muted">{formatClock(item.time, locale)}</span>
                      </label>
                    );
                  })}
                </fieldset>
              </Card>
              {held && <Banner tone="info">{t("alreadyHolding")}</Banner>}
              {closed && <Banner tone="warning">{t("bookingClosed")}</Banner>}
              {full && !held && <Banner tone="danger">{t("lineFull")}</Banner>}
              {!held && !closed && !full && (
                <Button block size="lg" disabled={!stop} onClick={() => setConfirm(true)}>
                  {t("reserve")}
                </Button>
              )}
            </div>
            <ConfirmDialog
              open={confirm && !!stop}
              title={t("confirmTitle")}
              confirmLabel={t("confirmReserve")}
              pending={reserve.pending}
              error={error || undefined}
              onClose={() => {
                setConfirm(false);
                reserve.reset();
              }}
              onConfirm={async () => {
                if (stop && (await reserve.run(data.id, stop.id))) router.push("/student/payment");
              }}
            >
              <p>{t("confirmBody", { line: data.name, stop: stop?.name ?? "", price: formatMoney(data.price, locale) })}</p>
              <p className="text-ink-muted">{t("holdNote")}</p>
            </ConfirmDialog>
          </>
        );
      }}
    </Async>
  );
}
