"use client";

import { Timer } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Radio } from "@/components/ui/choice";
import { EmptyState } from "@/components/ui/empty-state";
import { TextField } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Tone } from "@/components/ui/tone";
import { useToast } from "@/components/ui/toast";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatNumber, formatTime } from "@/lib/format";
import { useSubmit } from "@/lib/hooks/use-submit";
import { reportDelay } from "../api";
import {
  CREW_NOTE_MAX_LENGTH,
  CrewErrorCode,
  CrewTripStatus,
  DELAY_MINUTES,
  DELAY_REASONS,
  DelayReason,
  type CrewToday,
  type CrewTrip,
} from "../schema";
import { currentTrip } from "../trip-rules";
import { CrewGate } from "./crew-gate";

const DELAY_ERRORS = [CrewErrorCode.TripAlreadyEnded] as const;
const DEFAULT_MINUTES = 15;

/** "We're running late": students and guardians on the line get a delay notice. */
export function DelayPage() {
  const t = useTranslations("crew.delay");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("lead")} />
      <CrewGate>{(today, refresh) => <DelayView today={today} refresh={refresh} />}</CrewGate>
    </div>
  );
}

function DelayView({ today, refresh }: { today: CrewToday; refresh: () => void }) {
  const t = useTranslations("crew.delay");
  const trip = currentTrip(today);
  if (!trip || trip.status === CrewTripStatus.Ended) {
    return (
      <EmptyState
        icon={<Timer />}
        title={t("endedTitle")}
        description={t("endedBody")}
        action={<ButtonLink href="/driver">{t("goToTrip")}</ButtonLink>}
      />
    );
  }
  return (
    <div className="grid items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <DelayForm trip={trip} onSent={refresh} />
      <Sent trip={trip} />
    </div>
  );
}

function DelayForm({ trip, onSent }: { trip: CrewTrip; onSent: () => void }) {
  const t = useTranslations("crew.delay");
  const tReason = useTranslations("crew.trip.delayReasons");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const toast = useToast();
  const [minutes, setMinutes] = useState<number>(DEFAULT_MINUTES);
  const [reason, setReason] = useState<DelayReason>(DelayReason.Traffic);
  const [note, setNote] = useState("");
  const { submit, isSending, serverError } = useSubmit(DELAY_ERRORS);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const sent = await submit((idempotencyKey) =>
      reportDelay(trip.trip_id, { minutes, reason, note: note.trim() || null }, { idempotencyKey }),
    );
    if (sent) {
      toast.show({ title: t("sentTitle"), description: t("sentBody"), tone: Tone.Success });
      setNote("");
      onSent();
    }
  }

  return (
    <Card elevation="raised">
      <CardBody>
        <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-body-sm font-bold text-ink-strong">{t("howLate")}</legend>
            <div className="flex flex-wrap gap-2">
              {DELAY_MINUTES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={minutes === value}
                  onClick={() => setMinutes(value)}
                  className={cn(
                    "min-h-tap min-w-16 rounded-md border px-3 py-2 text-body-sm focus-ring transition-colors",
                    minutes === value
                      ? "border-brand bg-brand-soft font-bold text-brand"
                      : "border-line bg-surface-raised text-ink-strong hover:bg-surface-alt",
                  )}
                >
                  {t("minutes", { minutes: formatNumber(value, locale) })}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-body-sm font-bold text-ink-strong">{t("why")}</legend>
            {DELAY_REASONS.map((value) => (
              <Radio
                key={value}
                name="delay-reason"
                value={value}
                label={tReason(value)}
                checked={reason === value}
                onChange={() => setReason(value)}
              />
            ))}
          </fieldset>
          <TextField
            label={t("note")}
            hint={t("noteHint")}
            optionalText={tCommon("optional")}
            maxLength={CREW_NOTE_MAX_LENGTH}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <Alert tone={Tone.Info} title={t("whoKnowsTitle")}>
            {t("whoKnowsBody")}
          </Alert>
          {serverError ? <Alert tone={Tone.Danger} title={t(`errors.${serverError}`)} /> : null}
          <Button type="submit" withArrow isLoading={isSending} className="self-start">
            {t("submit")}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function Sent({ trip }: { trip: CrewTrip }) {
  const t = useTranslations("crew.delay");
  const tTrip = useTranslations("crew.trip");
  const locale = useLocale() as Locale;
  return (
    <Card>
      <CardHeader title={t("sentListTitle")} headingLevel={2} />
      <CardBody>
        {trip.delays.length === 0 ? (
          <p className="text-body-sm text-ink-muted">{t("sentListEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {[...trip.delays].reverse().map((delay) => (
              <li key={delay.delay_id} className="rounded-md border border-line p-3">
                <p className="text-body font-bold text-ink-strong">
                  {tTrip("delayMinutes", { minutes: formatNumber(delay.minutes, locale) })} ·{" "}
                  {tTrip(`delayReasons.${delay.reason}`)}
                </p>
                <p className="text-body-sm text-ink-muted">
                  {formatTime(delay.reported_at, locale)}
                  {delay.note ? ` · ${delay.note}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
