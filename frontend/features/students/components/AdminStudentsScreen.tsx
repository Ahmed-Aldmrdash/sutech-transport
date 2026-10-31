"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { useCanEdit } from "@/components/layout/RequirePage";
import { Async } from "@/components/ui/Async";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { type Column, Table } from "@/components/ui/Table";
import { listLines } from "@/features/lines/api";
import { SubscriptionPill } from "@/features/subscriptions/components/SubscriptionPill";
import { isActive } from "@/features/subscriptions/schema";
import { useApi } from "@/lib/api/use-api";
import { listStudents } from "../api";
import type { AdminStudent } from "../schema";
import { CancelForm, TransferForm } from "./StudentActions";

const SEARCH_DELAY_MS = 300;

export function AdminStudentsScreen() {
  const t = useTranslations("admin.students");
  const canEdit = useCanEdit();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [lineId, setLineId] = useState("");
  const [action, setAction] = useState<{ type: "transfer" | "cancel"; student: AdminStudent } | null>(null);
  const lines = useApi(listLines);
  const query = useApi(() => listStudents(lineId || undefined, q || undefined), [lineId, q]);

  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(id);
  }, [text]);

  const columns: Column<AdminStudent>[] = [
    { key: "name", header: t("name"), cell: (row) => <span className="font-bold text-ink-strong">{row.name}</span> },
    { key: "id", header: t("id"), cell: (row) => <span className="num">{row.id}</span> },
    { key: "faculty", header: t("faculty"), cell: (row) => `${row.faculty} · ${row.level}` },
    { key: "status", header: t("status"), cell: (row) => <SubscriptionPill status={row.status} /> },
    {
      key: "line",
      header: t("line"),
      cell: (row) => (
        <span>
          {row.line_name ?? "—"}
          {row.stop_name && <span className="block text-[13px] text-ink-muted">{row.stop_name}</span>}
          {row.assignment && <span className="block text-[13px] text-teal-text">{t(`assignment.${row.assignment.kind}`, { line: row.assignment.line_name })}</span>}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("actions")}</span>,
      cell: (row) =>
        canEdit && isActive(row) && (
          <span className="flex gap-1">
            <Button size="sm" variant="secondary" onClick={() => setAction({ type: "transfer", student: row })}>
              {t("transfer")}
            </Button>
            <Button size="sm" variant="dangerGhost" onClick={() => setAction({ type: "cancel", student: row })}>
              {t("cancel")}
            </Button>
          </span>
        ),
    },
  ];

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <Field label={t("search")}>
          {(props) => (
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
              <Input {...props} value={text} onChange={(event) => setText(event.target.value)} className="ps-9" placeholder={t("searchHint")} />
            </div>
          )}
        </Field>
        <Field label={t("line")}>
          {(props) => (
            <Select {...props} value={lineId} onChange={(event) => setLineId(event.target.value)}>
              <option value="">{t("allLines")}</option>
              {(lines.data?.items ?? []).map((line) => (
                <option key={line.id} value={line.id}>
                  {line.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Async query={query}>
        {(data) => (
          <>
            <p className="mb-2 text-[14px] text-ink-muted">{t("count", { count: data.total })}</p>
            <Table rows={data.items} columns={columns} rowKey={(row) => row.id} caption={t("title")} empty={t("empty")} />
          </>
        )}
      </Async>
      <Dialog open={!!action} onClose={() => setAction(null)} title={action?.type === "cancel" ? t("cancelSubscription") : t("transfer")} tone={action?.type === "cancel" ? "danger" : "default"}>
        {action?.type === "transfer" && <TransferForm student={action.student} lines={lines.data?.items ?? []} onDone={() => setAction(null)} />}
        {action?.type === "cancel" && <CancelForm student={action.student} onDone={() => setAction(null)} />}
      </Dialog>
    </>
  );
}
