"use client";

import { useState } from "react";
import { Check, Image as ImageIcon, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { useCanEdit } from "@/components/layout/RequirePage";
import { Async } from "@/components/ui/Async";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Textarea } from "@/components/ui/Field";
import { Pill, type Tone } from "@/components/ui/Pill";
import { Segmented } from "@/components/ui/Segmented";
import { useErrorMessage } from "@/components/ui/States";
import { type Column, Table } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useApi, useMutation } from "@/lib/api/use-api";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { decidePayment, listPayments } from "../api";
import type { AdminPayment } from "../schema";

type Filter = "pending" | "all";
const TONE: Record<AdminPayment["status"], Tone> = { pending: "warning", approved: "success", rejected: "danger" };

/** Finance reviews InstaPay and bank receipts; Fawry payments confirm themselves. */
export function AdminPaymentsScreen() {
  const t = useTranslations("admin.payments");
  const locale = useLocale();
  const toast = useToast();
  const canEdit = useCanEdit();
  const query = useApi(listPayments);
  const decide = useMutation(decidePayment);
  const error = useErrorMessage(decide.error);
  const [filter, setFilter] = useState<Filter>("pending");
  const [viewing, setViewing] = useState<AdminPayment | null>(null);
  const [rejecting, setRejecting] = useState<AdminPayment | null>(null);
  const [reason, setReason] = useState("");

  const columns: Column<AdminPayment>[] = [
    { key: "student", header: t("student"), cell: (row) => <span><b className="text-ink-strong">{row.student_name}</b><span className="num block text-[13px] text-ink-muted">{row.student_id}</span></span> },
    { key: "line", header: t("line"), cell: (row) => row.line_name },
    { key: "amount", header: t("amount"), cell: (row) => <span className="num font-bold">{formatMoney(row.amount, locale)}</span> },
    { key: "method", header: t("method"), cell: (row) => <span>{t(`methods.${row.method}`)}{row.automatic && <span className="block text-[12px] text-ink-muted">{t("automatic")}</span>}</span> },
    { key: "reference", header: t("reference"), cell: (row) => <span className="num" dir="ltr">{row.reference}</span> },
    { key: "at", header: t("at"), cell: (row) => <span className="text-[13px]">{formatDateTime(row.created_at, locale)}</span> },
    { key: "status", header: t("status"), cell: (row) => <span><Pill tone={TONE[row.status]}>{t(`statuses.${row.status}`)}</Pill>{row.rejection_reason && <span className="block text-[12px] text-danger">{row.rejection_reason}</span>}</span> },
    {
      key: "actions",
      header: <span className="sr-only">{t("actions")}</span>,
      cell: (row) => (
        <span className="flex flex-wrap gap-1">
          {row.receipt_image && (
            <Button size="sm" variant="ghost" icon={<ImageIcon className="size-4" aria-hidden />} onClick={() => setViewing(row)}>
              {t("receipt")}
            </Button>
          )}
          {canEdit && row.status === "pending" && !row.automatic && (
            <>
              <Button size="sm" variant="teal" icon={<Check className="size-4" aria-hidden />} loading={decide.pending} onClick={async () => (await decide.run(row.id, true)) && toast(t("approved"))}>
                {t("approve")}
              </Button>
              <Button size="sm" variant="dangerGhost" icon={<X className="size-4" aria-hidden />} onClick={() => setRejecting(row)}>
                {t("reject")}
              </Button>
            </>
          )}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="mb-4 max-w-sm">
        <Segmented label={t("filter")} value={filter} onChange={setFilter} options={[{ value: "pending", label: t("pending") }, { value: "all", label: t("all") }]} />
      </div>
      {error && <Banner tone="danger" className="mb-3">{error}</Banner>}
      <Async query={query}>
        {(items) => <Table rows={filter === "pending" ? items.filter((row) => row.status === "pending") : items} columns={columns} rowKey={(row) => row.id} caption={t("title")} empty={t("empty")} />}
      </Async>
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title={t("receiptOf", { name: viewing?.student_name ?? "" })}>
        {viewing?.receipt_image && (
          // eslint-disable-next-line @next/next/no-img-element -- receipts are user uploads (data URLs), not optimisable assets
          <img src={viewing.receipt_image} alt={t("receiptAlt", { reference: viewing.reference })} className="mx-auto max-h-[70vh] rounded-md" />
        )}
      </Dialog>
      <ConfirmDialog
        open={!!rejecting}
        danger
        title={t("rejectTitle")}
        confirmLabel={t("reject")}
        pending={decide.pending}
        confirmDisabled={reason.trim().length < 3}
        onClose={() => setRejecting(null)}
        onConfirm={async () => {
          if (rejecting && reason.trim().length >= 3 && (await decide.run(rejecting.id, false, reason.trim()))) {
            setRejecting(null);
            setReason("");
            toast(t("rejected"));
          }
        }}
      >
        <p>{t("rejectBody")}</p>
        <Field label={t("reason")}>{(props) => <Textarea {...props} value={reason} maxLength={200} onChange={(event) => setReason(event.target.value)} />}</Field>
      </ConfirmDialog>
    </>
  );
}
