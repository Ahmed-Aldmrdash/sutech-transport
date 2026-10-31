"use client";

import { type FormEvent, useState } from "react";
import { GraduationCap } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { useCanEdit } from "@/components/layout/RequirePage";
import { Async } from "@/components/ui/Async";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { EmptyState, useErrorMessage } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { listBuses } from "@/features/fleet/api";
import type { Bus } from "@/features/fleet/schema";
import { listLines } from "@/features/lines/api";
import type { Line } from "@/features/lines/schema";
import { combineQueries, useApi, useMutation } from "@/lib/api/use-api";
import { formatClock } from "@/lib/time";
import { cancelDeparture, createDeparture, listDepartures, listLectures } from "../api";
import { type Lecture, NewDeparture } from "../schema";

/** Extra return trips for today, usually when a lecture ends earlier or later than the timetable. */
export function AdminDeparturesScreen() {
  const t = useTranslations("admin.departures");
  const locale = useLocale();
  const toast = useToast();
  const canEdit = useCanEdit();
  const query = combineQueries(combineQueries(useApi(listDepartures), useApi(listLectures)), combineQueries(useApi(listLines), useApi(listBuses)));
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const cancel = useMutation(cancelDeparture);
  const error = useErrorMessage(cancel.error);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Async query={query}>
        {([[departures, lectures], [lines, buses]]) => (
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="flex flex-col gap-4">
              <Card>
                <CardTitle>{t("lectures")}</CardTitle>
                {lectures.length === 0 ? (
                  <p className="text-ink-muted">{t("noLectures")}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {lectures.map((item) => (
                      <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-alt p-3">
                        <span className="flex items-center gap-2">
                          <GraduationCap className="size-4 text-brand" aria-hidden />
                          <span>
                            <b>{item.group}</b> · {t("endsAt", { time: formatClock(item.ends_at, locale) })} · {t("students", { count: item.students })}
                            {item.note && <span className="block text-[13px] text-ink-muted">{item.note}</span>}
                          </span>
                        </span>
                        {canEdit && (
                          <Button size="sm" variant="secondary" onClick={() => setLecture(item)}>
                            {t("planForLecture")}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              {canEdit && (
                <Card>
                  <CardTitle>{t("new")}</CardTitle>
                  <DepartureForm key={lecture?.id ?? "free"} lines={lines.items} buses={buses} lecture={lecture} onDone={() => setLecture(null)} />
                </Card>
              )}
            </div>
            <Card className="self-start">
              <CardTitle>{t("today")}</CardTitle>
              {error && <Banner tone="danger" className="mb-3">{error}</Banner>}
              {departures.length === 0 ? (
                <EmptyState title={t("none")} />
              ) : (
                <ul className="flex flex-col gap-2">
                  {departures.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-3">
                      <span>
                        <b className="num">{formatClock(item.time, locale)}</b> · {item.line_name}
                        <span className="block text-[13px] text-ink-muted">
                          {item.reason} · {t("booked", { booked: item.booked, capacity: item.capacity })}
                        </span>
                      </span>
                      {item.status === "cancelled" ? (
                        <Pill tone="danger">{t("cancelled")}</Pill>
                      ) : (
                        canEdit && (
                          <Button size="sm" variant="dangerGhost" loading={cancel.pending} onClick={async () => (await cancel.run(item.id)) && toast(t("cancelledToast"))}>
                            {t("cancel")}
                          </Button>
                        )
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </Async>
    </>
  );
}

function DepartureForm({ lines, buses, lecture, onDone }: { lines: Line[]; buses: Bus[]; lecture: Lecture | null; onDone: () => void }) {
  const t = useTranslations("admin.departures");
  const toast = useToast();
  const usable = buses.filter((bus) => bus.status === "ok");
  const [time, setTime] = useState(lecture?.ends_at ?? "");
  const [lineId, setLineId] = useState("");
  const [busId, setBusId] = useState(usable[0]?.id ?? "");
  const [reason, setReason] = useState(lecture ? t("lectureReason", { group: lecture.group }) : "");
  const [invalid, setInvalid] = useState(false);
  const create = useMutation(createDeparture);
  const error = useErrorMessage(create.error);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = NewDeparture.safeParse({ time, line_id: lineId || null, bus_id: busId, reason: reason.trim(), lecture_id: lecture?.id ?? null });
    if (!parsed.success) return setInvalid(true);
    setInvalid(false);
    if (await create.run(parsed.data)) {
      toast(t("created"));
      onDone();
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      {lecture && <Banner tone="info">{t("forLecture", { group: lecture.group })}</Banner>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("time")}>{(props) => <Input {...props} type="time" value={time} onChange={(event) => setTime(event.target.value)} />}</Field>
        <Field label={t("line")}>
          {(props) => (
            <Select {...props} value={lineId} onChange={(event) => setLineId(event.target.value)}>
              <option value="">{t("allLines")}</option>
              {lines.map((line) => (
                <option key={line.id} value={line.id}>
                  {line.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label={t("bus")}>
        {(props) => (
          <Select {...props} value={busId} onChange={(event) => setBusId(event.target.value)}>
            {usable.map((bus) => (
              <option key={bus.id} value={bus.id}>
                {bus.plate} · {bus.capacity} {bus.line_name ? `· ${bus.line_name}` : ""}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={t("reason")}>{(props) => <Input {...props} value={reason} maxLength={200} onChange={(event) => setReason(event.target.value)} />}</Field>
      {invalid && <Banner tone="danger">{t("invalid")}</Banner>}
      {error && <Banner tone="danger">{error}</Banner>}
      <Button type="submit" loading={create.pending}>
        {t("create")}
      </Button>
    </form>
  );
}
