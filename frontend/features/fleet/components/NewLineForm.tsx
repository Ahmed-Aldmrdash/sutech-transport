"use client";

import { type FormEvent, useState } from "react";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { useErrorMessage } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useMutation } from "@/lib/api/use-api";
import { PIASTERS_PER_POUND } from "@/lib/money";
import { createLine } from "../api";
import { type Bus, NewLine } from "../schema";

const MAX_STOPS = 15;

/** A new line on a free bus. The university gate is added by the server as the last stop. */
export function NewLineForm({ buses, onDone }: { buses: Bus[]; onDone: () => void }) {
  const t = useTranslations("admin.lines");
  const toast = useToast();
  const free = buses.filter((bus) => !bus.line_id && bus.status === "ok");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [busId, setBusId] = useState(free[0]?.id ?? "");
  const [stops, setStops] = useState([{ name: "", time: "" }]);
  const [invalid, setInvalid] = useState(false);
  const create = useMutation(createLine);
  const error = useErrorMessage(create.error);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = NewLine.safeParse({ name: name.trim(), price: Math.round(Number(price) * PIASTERS_PER_POUND), bus_id: busId, stops: stops.map((stop) => ({ name: stop.name.trim(), time: stop.time })) });
    if (!parsed.success) return setInvalid(true);
    setInvalid(false);
    if (await create.run(parsed.data)) {
      toast(t("created"));
      onDone();
    }
  }

  if (!free.length) return <Banner tone="warning">{t("noFreeBus")}</Banner>;
  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <Field label={t("name")}>{(props) => <Input {...props} value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />}</Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("priceEgp")}>{(props) => <Input {...props} type="number" min={1} value={price} onChange={(event) => setPrice(event.target.value)} />}</Field>
        <Field label={t("bus")}>
          {(props) => (
            <Select {...props} value={busId} onChange={(event) => setBusId(event.target.value)}>
              {free.map((bus) => (
                <option key={bus.id} value={bus.id}>
                  {bus.plate} · {bus.capacity}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[14px] font-bold">{t("stops")}</legend>
        {stops.map((stop, index) => (
          <div key={index} className="grid grid-cols-[1fr_8rem_auto] items-center gap-2">
            <Input aria-label={t("stopName")} placeholder={t("stopName")} value={stop.name} onChange={(event) => setStops((list) => list.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)))} />
            <Input aria-label={t("stopTime")} type="time" value={stop.time} onChange={(event) => setStops((list) => list.map((item, i) => (i === index ? { ...item, time: event.target.value } : item)))} />
            <Button variant="ghost" size="sm" aria-label={t("removeStop")} disabled={stops.length === 1} onClick={() => setStops((list) => list.filter((_, i) => i !== index))} icon={<X className="size-4" aria-hidden />} />
          </div>
        ))}
        <Button variant="ghost" size="sm" className="self-start" disabled={stops.length >= MAX_STOPS} icon={<Plus className="size-4" aria-hidden />} onClick={() => setStops((list) => [...list, { name: "", time: "" }])}>
          {t("addStopRow")}
        </Button>
        <p className="text-[13px] text-ink-muted">{t("gateNote")}</p>
      </fieldset>
      {invalid && <Banner tone="danger">{t("invalid")}</Banner>}
      {error && <Banner tone="danger">{error}</Banner>}
      <Button type="submit" loading={create.pending}>
        {t("create")}
      </Button>
    </form>
  );
}
