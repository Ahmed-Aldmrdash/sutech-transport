"use client";

import { type FormEvent, useState } from "react";
import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { useErrorMessage } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useMutation } from "@/lib/api/use-api";
import { type ReportDelayReason as Reason, reportDelay } from "../api";
import { type CrewTrip, ReportDelay } from "../schema";

const REASONS: Reason[] = ["traffic", "breakdown", "weather", "checkpoint", "other"];

/** Tells riders and parents on the line that the bus is late (published as a delay announcement). */
export function DelayForm({ trip }: { trip: CrewTrip }) {
  const t = useTranslations("crew.delay");
  const toast = useToast();
  const [minutes, setMinutes] = useState("10");
  const [reason, setReason] = useState<Reason>("traffic");
  const [invalid, setInvalid] = useState(false);
  const report = useMutation(reportDelay);
  const error = useErrorMessage(report.error);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = ReportDelay.safeParse({ minutes: Number(minutes), reason });
    if (!parsed.success) return setInvalid(true);
    setInvalid(false);
    if (await report.run(trip.trip_id, parsed.data.minutes, parsed.data.reason)) toast(t("sent"));
  }

  return (
    <Card>
      <CardTitle>{t("title")}</CardTitle>
      {trip.state !== "in_progress" ? (
        <p className="text-ink-muted">{t("onlyRunning")}</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("minutes")} error={invalid ? t("invalid") : undefined}>
              {(props) => <Input {...props} type="number" min={1} max={180} inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value)} />}
            </Field>
            <Field label={t("reason")}>
              {(props) => (
                <Select {...props} value={reason} onChange={(event) => setReason(event.target.value as Reason)}>
                  {REASONS.map((value) => (
                    <option key={value} value={value}>
                      {t(`reasons.${value}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          {error && <Banner tone="danger">{error}</Banner>}
          <Button type="submit" variant="secondary" icon={<Clock className="size-4" aria-hidden />} loading={report.pending}>
            {t("send")}
          </Button>
        </form>
      )}
    </Card>
  );
}
