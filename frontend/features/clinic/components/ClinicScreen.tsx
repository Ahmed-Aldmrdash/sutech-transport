"use client";

import { type FormEvent, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { useCanEdit } from "@/components/layout/RequirePage";
import { Async } from "@/components/ui/Async";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { Pill, type Tone } from "@/components/ui/Pill";
import { useErrorMessage } from "@/components/ui/States";
import { type Column, Table } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useApi, useMutation } from "@/lib/api/use-api";
import { cairoDate, formatDate } from "@/lib/time";
import { issuePermit, listPermits, revokePermit } from "../api";
import { NewPermit, type Permit, PermitKind } from "../schema";

type Kind = Permit["kind"];
const TONE: Record<Permit["status"], Tone> = { active: "success", revoked: "danger", expired: "neutral" };

/** Medical permits: a priority seat on the bus, medical leave, or an escort. The crew sees priority seats on the rider list. */
export function ClinicScreen() {
  const t = useTranslations("admin.clinic");
  const locale = useLocale();
  const toast = useToast();
  const canEdit = useCanEdit();
  const query = useApi(listPermits);
  const revoke = useMutation(revokePermit);
  const revokeError = useErrorMessage(revoke.error);
  const columns: Column<Permit>[] = [
    { key: "student", header: t("student"), cell: (row) => <span><b className="text-ink-strong">{row.student_name}</b><span className="num block text-[13px] text-ink-muted">{row.student_id}</span></span> },
    { key: "kind", header: t("kind"), cell: (row) => t(`kinds.${row.kind}`) },
    { key: "dates", header: t("dates"), cell: (row) => `${formatDate(row.from, locale)} – ${formatDate(row.to, locale)}` },
    { key: "by", header: t("issuedBy"), cell: (row) => row.issued_by },
    { key: "status", header: t("status"), cell: (row) => <Pill tone={TONE[row.status]}>{t(`statuses.${row.status}`)}</Pill> },
    {
      key: "actions",
      header: <span className="sr-only">{t("revoke")}</span>,
      cell: (row) =>
        canEdit && row.status === "active" && (
          <Button size="sm" variant="dangerGhost" loading={revoke.pending} onClick={async () => (await revoke.run(row.id)) && toast(t("revoked"))}>
            {t("revoke")}
          </Button>
        ),
    },
  ];
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        {canEdit && (
          <Card className="self-start">
            <CardTitle>{t("new")}</CardTitle>
            <PermitForm />
          </Card>
        )}
        <div className="flex flex-col gap-3">
          {revokeError && <Banner tone="danger">{revokeError}</Banner>}
          <Async query={query}>{(items) => <Table rows={items} columns={columns} rowKey={(row) => row.id} caption={t("title")} empty={t("empty")} />}</Async>
        </div>
      </div>
    </>
  );
}

function PermitForm() {
  const t = useTranslations("admin.clinic");
  const toast = useToast();
  const [studentId, setStudentId] = useState("");
  const [kind, setKind] = useState<Kind>(PermitKind.PrioritySeat);
  const [from, setFrom] = useState(cairoDate());
  const [to, setTo] = useState("");
  const [invalid, setInvalid] = useState(false);
  const issue = useMutation(issuePermit);
  const error = useErrorMessage(issue.error);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = NewPermit.safeParse({ student_id: studentId.trim(), kind, from, to });
    if (!parsed.success || to < from) return setInvalid(true);
    setInvalid(false);
    if (await issue.run(parsed.data)) {
      setStudentId("");
      setTo("");
      toast(t("issued"));
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <Field label={t("studentId")}>{(props) => <Input {...props} value={studentId} inputMode="numeric" maxLength={9} dir="ltr" className="num text-start" onChange={(event) => setStudentId(event.target.value.replace(/\D/g, ""))} />}</Field>
      <Field label={t("kind")}>
        {(props) => (
          <Select {...props} value={kind} onChange={(event) => setKind(event.target.value as Kind)}>
            {Object.values(PermitKind).map((value) => (
              <option key={value} value={value}>
                {t(`kinds.${value}`)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("from")}>{(props) => <Input {...props} type="date" value={from} onChange={(event) => setFrom(event.target.value)} />}</Field>
        <Field label={t("to")}>{(props) => <Input {...props} type="date" min={from} value={to} onChange={(event) => setTo(event.target.value)} />}</Field>
      </div>
      {invalid && <Banner tone="danger">{t("invalid")}</Banner>}
      {error && <Banner tone="danger">{error}</Banner>}
      <Button type="submit" loading={issue.pending}>
        {t("issue")}
      </Button>
    </form>
  );
}
