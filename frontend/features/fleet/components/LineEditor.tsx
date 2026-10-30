"use client";

import { type FormEvent, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Meter } from "@/components/ui/Meter";
import { useErrorMessage } from "@/components/ui/States";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import type { Line } from "@/features/lines/schema";
import { useMutation } from "@/lib/api/use-api";
import { PIASTERS_PER_POUND, formatMoney } from "@/lib/money";
import { formatClock } from "@/lib/time";
import { addStop, setLinePrice, toggleStop } from "../api";

/** One line for the transport office: price for new bookings, stops on/off, add a stop before the gate. */
export function LineEditor({ line, canEdit }: { line: Line; canEdit: boolean }) {
  const t = useTranslations("admin.lines");
  const locale = useLocale();
  const toast = useToast();
  const [price, setPrice] = useState(String(line.price / PIASTERS_PER_POUND));
  const [stopName, setStopName] = useState("");
  const [stopTime, setStopTime] = useState("");
  const savePrice = useMutation(setLinePrice);
  const toggle = useMutation(toggleStop);
  const add = useMutation(addStop);
  const error = useErrorMessage(savePrice.error ?? toggle.error ?? add.error);

  async function submitStop(event: FormEvent) {
    event.preventDefault();
    if (stopName.trim().length < 2 || !/^\d{2}:\d{2}$/.test(stopTime)) return;
    if (await add.run(line.id, stopName.trim(), stopTime)) {
      setStopName("");
      setStopTime("");
      toast(t("stopAdded"));
    }
  }

  return (
    <Card as="article" className="flex flex-col gap-4">
      <CardTitle action={<span className="num font-extrabold text-brand">{formatMoney(line.price, locale)}</span>}>{line.name}</CardTitle>
      <div className="flex flex-col gap-1 text-[14px]">
        <span className="text-ink-muted">
          <bdi>{line.bus_plate ?? "—"}</bdi> · {line.driver_name ?? "—"} · {t("booked", { booked: line.booked, capacity: line.capacity })}
        </span>
        <Meter value={line.booked} max={line.capacity} label={line.name} />
      </div>
      {canEdit && (
        <form
          className="flex items-end gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const piasters = Math.round(Number(price) * PIASTERS_PER_POUND);
            if (Number.isFinite(piasters) && piasters >= 100 && (await savePrice.run(line.id, piasters))) toast(t("priceSaved"));
          }}
        >
          <Field label={t("price")} hint={t("priceHint")} className="flex-1">
            {(props) => <Input {...props} type="number" min={1} step="1" value={price} onChange={(event) => setPrice(event.target.value)} />}
          </Field>
          <Button type="submit" variant="secondary" loading={savePrice.pending} className="mb-6">
            {t("savePrice")}
          </Button>
        </form>
      )}
      <ul className="flex flex-col divide-y divide-line">
        {line.stops.map((stop) => (
          <li key={stop.id} className="py-1">
            {stop.is_destination || !canEdit ? (
              <p className="flex min-h-12 items-center justify-between">
                <span className="font-bold">{stop.name}</span>
                <span className="num text-[14px] text-ink-muted">{formatClock(stop.time, locale)}</span>
              </p>
            ) : (
              <Switch
                checked={stop.active}
                disabled={toggle.pending}
                label={stop.name}
                description={`${formatClock(stop.time, locale)}${stop.active ? "" : ` · ${t("paused")}`}`}
                onChange={(active) => void toggle.run(line.id, stop.id, active)}
              />
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form onSubmit={submitStop} className="grid grid-cols-[1fr_auto] items-end gap-2 sm:grid-cols-[1fr_9rem_auto]">
          <Field label={t("stopName")}>{(props) => <Input {...props} value={stopName} maxLength={60} onChange={(event) => setStopName(event.target.value)} />}</Field>
          <Field label={t("stopTime")}>{(props) => <Input {...props} type="time" value={stopTime} onChange={(event) => setStopTime(event.target.value)} />}</Field>
          <Button type="submit" variant="secondary" loading={add.pending} className="col-span-2 sm:col-span-1">
            {t("addStop")}
          </Button>
        </form>
      )}
      {error && <Banner tone="danger">{error}</Banner>}
    </Card>
  );
}
