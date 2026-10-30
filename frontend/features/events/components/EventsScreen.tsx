"use client";

import { type FormEvent, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { useCanEdit } from "@/components/layout/RequirePage";
import { Async } from "@/components/ui/Async";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { EmptyState, useErrorMessage } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useApi, useMutation } from "@/lib/api/use-api";
import { cairoDate, formatDate } from "@/lib/time";
import { cancelEvent, createEvent, listEvents } from "../api";
import { NewEvent } from "../schema";
import { EventStatusPill } from "./EventStatusPill";

/** Trips for university events. Free university buses go first; the rest is requested from the bus company. */
export function EventsScreen() {
  const t = useTranslations("admin.events");
  const locale = useLocale();
  const toast = useToast();
  const canEdit = useCanEdit();
  const query = useApi(listEvents);
  const cancel = useMutation(cancelEvent);
  const error = useErrorMessage(cancel.error);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        {canEdit && (
          <Card className="self-start">
            <CardTitle>{t("new")}</CardTitle>
            <EventForm />
          </Card>
        )}
        <div className="flex flex-col gap-3">
          {error && <Banner tone="danger">{error}</Banner>}
          <Async query={query}>
            {(items) =>
              items.length === 0 ? (
                <EmptyState title={t("empty")} />
              ) : (
                items.map((item) => (
                  <Card as="article" key={item.id} className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-bold text-ink-strong">{item.name}</h3>
                      <EventStatusPill status={item.status} />
                    </div>
                    <p className="text-[14px] text-ink-muted">
                      {formatDate(item.date, locale, true)} · {t("studentsCount", { count: item.students })} · {t("busesNeeded", { count: item.buses_needed })}
                    </p>
                    <p className="text-[14px]">
                      {t("plan", { university: item.university_buses.length, company: item.company_buses })}
                      {item.university_buses.length > 0 && <span className="text-ink-muted"> ({item.university_buses.join("، ")})</span>}
                    </p>
                    {canEdit && item.status !== "cancelled" && (
                      <Button size="sm" variant="dangerGhost" className="self-end" loading={cancel.pending} onClick={async () => (await cancel.run(item.id)) && toast(t("cancelled"))}>
                        {t("cancel")}
                      </Button>
                    )}
                  </Card>
                ))
              )
            }
          </Async>
        </div>
      </div>
    </>
  );
}

function EventForm() {
  const t = useTranslations("admin.events");
  const toast = useToast();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [students, setStudents] = useState("");
  const [invalid, setInvalid] = useState(false);
  const create = useMutation(createEvent);
  const error = useErrorMessage(create.error);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = NewEvent.safeParse({ name: name.trim(), date, students: Number(students) });
    if (!parsed.success || date < cairoDate()) return setInvalid(true);
    setInvalid(false);
    if (await create.run(parsed.data)) {
      setName("");
      setDate("");
      setStudents("");
      toast(t("created"));
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <Field label={t("name")}>{(props) => <Input {...props} value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("date")}>{(props) => <Input {...props} type="date" min={cairoDate()} value={date} onChange={(event) => setDate(event.target.value)} />}</Field>
        <Field label={t("students")}>{(props) => <Input {...props} type="number" min={1} max={5000} value={students} onChange={(event) => setStudents(event.target.value)} />}</Field>
      </div>
      {invalid && <Banner tone="danger">{t("invalid")}</Banner>}
      {error && <Banner tone="danger">{error}</Banner>}
      <Button type="submit" loading={create.pending}>
        {t("create")}
      </Button>
    </form>
  );
}
