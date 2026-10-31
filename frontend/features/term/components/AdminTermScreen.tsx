"use client";

import { type FormEvent, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { useCanEdit } from "@/components/layout/RequirePage";
import { Async } from "@/components/ui/Async";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Checkbox, Field, Input } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { useErrorMessage } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { RefundPolicy } from "@/features/requests/components/RefundPolicy";
import { useApi, useMutation } from "@/lib/api/use-api";
import { cairoDate, formatDate } from "@/lib/time";
import { getTerm, setBooking, setNextTerm } from "../api";
import { type Term, UpdateNextTerm } from "../schema";

export function AdminTermScreen() {
  const t = useTranslations("admin.term");
  const locale = useLocale();
  const toast = useToast();
  const canEdit = useCanEdit();
  const query = useApi(getTerm);
  const booking = useMutation(setBooking);
  const bookingError = useErrorMessage(booking.error);
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Async query={query}>
        {(term) => {
          const open = term.current.booking === "open";
          return (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="flex flex-col gap-3">
                <CardTitle action={<Pill tone={open ? "success" : "neutral"}>{t(open ? "open" : "closed")}</Pill>}>{term.current.name}</CardTitle>
                <p className="text-ink-muted">{t("closesOn", { date: formatDate(term.current.booking_closes_on, locale) })}</p>
                <p className="text-ink-muted">{term.current.week === 0 ? t("notStarted") : t("week", { week: term.current.week })}</p>
                {canEdit && (
                  <Button variant={open ? "secondary" : "primary"} onClick={() => setConfirm(true)}>
                    {open ? t("closeBooking") : t("openBooking")}
                  </Button>
                )}
                <RefundPolicy policy={term.refund_policy} week={term.current.week} />
                <ConfirmDialog
                  open={confirm}
                  title={open ? t("closeBooking") : t("openBooking")}
                  confirmLabel={t("confirm")}
                  pending={booking.pending}
                  error={bookingError || undefined}
                  onClose={() => setConfirm(false)}
                  onConfirm={async () => {
                    if (await booking.run(open ? "closed" : "open")) {
                      setConfirm(false);
                      toast(t("saved"));
                    }
                  }}
                >
                  <p>{open ? t("closeBody") : t("openBody")}</p>
                </ConfirmDialog>
              </Card>
              <Card>
                <CardTitle>{t("nextTerm")}</CardTitle>
                {term.next && (
                  <Banner tone="info" className="mb-3" title={term.next.name}>
                    {t("nextSummary", {
                      opens: formatDate(term.next.booking_opens_on, locale),
                      closes: formatDate(term.next.booking_closes_on, locale),
                      starts: formatDate(term.next.starts_on, locale),
                    })}
                  </Banner>
                )}
                {canEdit && <NextTermForm term={term} />}
              </Card>
            </div>
          );
        }}
      </Async>
    </>
  );
}

function NextTermForm({ term }: { term: Term }) {
  const t = useTranslations("admin.term");
  const toast = useToast();
  const [value, setValue] = useState({
    name: term.next?.name ?? "",
    booking_opens_on: term.next?.booking_opens_on ?? "",
    booking_closes_on: term.next?.booking_closes_on ?? "",
    starts_on: term.next?.starts_on ?? "",
    announce: true,
  });
  const [invalid, setInvalid] = useState(false);
  const save = useMutation(setNextTerm);
  const error = useErrorMessage(save.error);
  const set = (key: keyof typeof value, next: string | boolean) => setValue((current) => ({ ...current, [key]: next }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = UpdateNextTerm.safeParse({ ...value, name: value.name.trim() });
    const ordered = value.booking_opens_on >= cairoDate() && value.booking_closes_on > value.booking_opens_on && value.starts_on > value.booking_closes_on;
    if (!parsed.success || !ordered) return setInvalid(true);
    setInvalid(false);
    if (await save.run(parsed.data)) toast(t("nextSaved"));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <Field label={t("name")}>{(props) => <Input {...props} value={value.name} onChange={(event) => set("name", event.target.value)} />}</Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("opensOn")}>{(props) => <Input {...props} type="date" min={cairoDate()} value={value.booking_opens_on} onChange={(event) => set("booking_opens_on", event.target.value)} />}</Field>
        <Field label={t("closesOnLabel")}>{(props) => <Input {...props} type="date" value={value.booking_closes_on} onChange={(event) => set("booking_closes_on", event.target.value)} />}</Field>
        <Field label={t("startsOn")}>{(props) => <Input {...props} type="date" value={value.starts_on} onChange={(event) => set("starts_on", event.target.value)} />}</Field>
      </div>
      <Checkbox label={t("announce")} checked={value.announce} onChange={(event) => set("announce", event.target.checked)} />
      {invalid && <Banner tone="danger">{t("invalid")}</Banner>}
      {error && <Banner tone="danger">{error}</Banner>}
      <Button type="submit" loading={save.pending}>
        {t("saveNext")}
      </Button>
    </form>
  );
}
