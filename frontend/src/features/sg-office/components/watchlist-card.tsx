"use client";

import { Eye, UserPlus, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { TextField } from "@/components/ui/input";
import { Tone } from "@/components/ui/tone";
import { DeskListState } from "@/features/desk-kit/components/desk-list-state";
import type { Locale } from "@/i18n/routing";
import { formatClockTime, formatTime, toLatinDigits, todayInCairo } from "@/lib/format";
import { useAsync } from "@/lib/hooks/use-async";
import { useSubmit } from "@/lib/hooks/use-submit";
import { getWatchlist, unwatchStudent, watchStudent } from "../api";
import { SgErrorCode, WatchedStatus, type WatchedStudent, type Watchlist } from "../schema";

const ERRORS = Object.values(SgErrorCode);
const REFRESH_MS = 30_000;

const STATUS_TONE: Record<WatchedStatus, Tone> = {
  [WatchedStatus.NoService]: Tone.Neutral,
  [WatchedStatus.NoSubscription]: Tone.Neutral,
  [WatchedStatus.Waiting]: Tone.Neutral,
  [WatchedStatus.OnBus]: Tone.Info,
  [WatchedStatus.Arrived]: Tone.Success,
  [WatchedStatus.CheckedOut]: Tone.Warning,
  [WatchedStatus.NotGoing]: Tone.Neutral,
  [WatchedStatus.Absent]: Tone.Danger,
};

/** A short list of students the office follows by name: did they get on the bus today? */
export function WatchlistCard({ date }: { date: string }) {
  const t = useTranslations("desk.sg.watch");
  const tErrors = useTranslations("desk.sg.errors");
  const isToday = date === todayInCairo();
  const state = useAsync((signal) => getWatchlist({ date }, { signal }), [date]);
  const { refresh } = state;
  const [identifier, setIdentifier] = useState("");
  const [inputError, setInputError] = useState<string>();
  const adder = useSubmit(ERRORS);
  const remover = useSubmit<never>([]);

  useEffect(() => {
    if (!isToday) return;
    const timer = window.setInterval(refresh, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [isToday, refresh]);

  async function add(event: FormEvent) {
    event.preventDefault();
    const id = toLatinDigits(identifier.trim());
    if (!id) {
      setInputError(t("idRequired"));
      return;
    }
    const done = await adder.submit((idempotencyKey) => watchStudent(id, { idempotencyKey }));
    if (!done) return;
    setIdentifier("");
    refresh();
  }

  async function remove(studentId: string) {
    const done = await remover.submit((idempotencyKey) =>
      unwatchStudent(studentId, { idempotencyKey }),
    );
    if (done) refresh();
  }

  return (
    <Card>
      <CardHeader title={t("title")} headingLevel={2} />
      <CardBody className="flex flex-col gap-4">
        <p className="text-body-sm text-ink">{t("lead")}</p>
        <form
          noValidate
          onSubmit={(event) => void add(event)}
          className="flex flex-wrap items-end gap-3"
        >
          <TextField
            label={t("identifier")}
            inputMode="numeric"
            dir="ltr"
            autoComplete="off"
            containerClassName="w-full max-w-xs"
            value={identifier}
            error={inputError}
            onChange={(event) => {
              setIdentifier(event.target.value);
              setInputError(undefined);
              adder.clearServerError();
            }}
          />
          <Button
            type="submit"
            variant="secondary"
            iconStart={<UserPlus />}
            isLoading={adder.isSending}
          >
            {t("add")}
          </Button>
        </form>
        {adder.serverError ? <Alert tone={Tone.Danger} title={tErrors(adder.serverError)} /> : null}
        {remover.serverError ? (
          <Alert tone={Tone.Danger} title={tErrors(remover.serverError)} />
        ) : null}
        <DeskListState state={state}>
          {(list: Watchlist) =>
            list.items.length === 0 ? (
              <p className="flex items-center gap-2 text-body-sm text-ink-muted">
                <Eye aria-hidden="true" className="size-5 text-teal" />
                {t("empty")}
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {list.items.map((item) => (
                  <li key={item.student.student_id} className="py-3 first:pt-0 last:pb-0">
                    <WatchedRow item={item} onRemove={() => void remove(item.student.student_id)} />
                  </li>
                ))}
              </ul>
            )
          }
        </DeskListState>
      </CardBody>
    </Card>
  );
}

function WatchedRow({ item, onRemove }: { item: WatchedStudent; onRemove: () => void }) {
  const t = useTranslations("desk.sg.watch");
  const locale = useLocale() as Locale;
  const { student } = item;
  const detail = [
    student.line ? t("lineValue", { code: student.line.code, name: student.line.name }) : null,
    student.stop_name && student.pickup_time
      ? t("stopValue", {
          stop: student.stop_name,
          time: formatClockTime(student.pickup_time, locale),
        })
      : null,
  ].filter(Boolean);
  const when =
    item.status === WatchedStatus.CheckedOut && item.checked_out_at
      ? t("leftAt", {
          time: formatTime(item.checked_out_at, locale),
          reason: item.checkout_reason ?? "",
        })
      : item.boarded_at
        ? t("boardedAt", { time: formatTime(item.boarded_at, locale) })
        : null;
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-body-sm font-bold text-ink-strong">{student.name}</p>
          <Badge tone={STATUS_TONE[item.status]}>{t(`statuses.${item.status}`)}</Badge>
        </div>
        <p className="text-caption text-ink-muted">
          <bdi>{student.identifier}</bdi>
          {detail.length ? ` · ${detail.join(" · ")}` : ""}
        </p>
        {when ? <p className="text-caption text-ink">{when}</p> : null}
      </div>
      <IconButton
        label={t("remove", { name: student.name })}
        icon={<X />}
        onClick={onRemove}
        size="sm"
      />
    </div>
  );
}
