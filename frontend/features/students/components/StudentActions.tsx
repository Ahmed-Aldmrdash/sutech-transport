"use client";

import { type FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { useErrorMessage } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { Line } from "@/features/lines/schema";
import { useMutation } from "@/lib/api/use-api";
import { cairoDate } from "@/lib/time";
import { cancelStudentSubscription, transferStudent } from "../api";
import type { AdminStudent } from "../schema";

type Kind = "today" | "temporary" | "permanent";

/** Move a student to another line: today only, until a date, or for good. */
export function TransferForm({ student, lines, onDone }: { student: AdminStudent; lines: Line[]; onDone: () => void }) {
  const t = useTranslations("admin.students");
  const toast = useToast();
  const [lineId, setLineId] = useState("");
  const [kind, setKind] = useState<Kind>("today");
  const [until, setUntil] = useState("");
  const transfer = useMutation(transferStudent);
  const error = useErrorMessage(transfer.error);
  const current = student.assignment?.line_id ?? student.line_id;
  const options = lines.filter((line) => line.id !== current);
  const valid = !!lineId && (kind !== "temporary" || !!until);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    if (await transfer.run(student.id, { to_line_id: lineId, kind, until: kind === "temporary" ? until : null })) {
      toast(t("transferred"));
      onDone();
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <p className="text-ink-muted">{t("transferFor", { name: student.name, line: student.line_name ?? "—" })}</p>
      <Field label={t("toLine")}>
        {(props) => (
          <Select {...props} value={lineId} onChange={(event) => setLineId(event.target.value)}>
            <option value="">{t("chooseLine")}</option>
            {options.map((line) => (
              <option key={line.id} value={line.id} disabled={line.seats_left === 0}>
                {line.name} ({t("seatsLeft", { count: line.seats_left })})
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={t("kind")}>
        {(props) => (
          <Select {...props} value={kind} onChange={(event) => setKind(event.target.value as Kind)}>
            <option value="today">{t("kinds.today")}</option>
            <option value="temporary">{t("kinds.temporary")}</option>
            <option value="permanent">{t("kinds.permanent")}</option>
          </Select>
        )}
      </Field>
      {kind === "temporary" && <Field label={t("until")}>{(props) => <Input {...props} type="date" min={cairoDate()} value={until} onChange={(event) => setUntil(event.target.value)} />}</Field>}
      {kind === "permanent" && <Banner tone="info">{t("permanentNote")}</Banner>}
      {error && <Banner tone="danger">{error}</Banner>}
      <Button type="submit" disabled={!valid} loading={transfer.pending}>
        {t("transfer")}
      </Button>
    </form>
  );
}

/** Cancels an active subscription (with a reason the student and parent see). Refunds go through a refund request. */
export function CancelForm({ student, onDone }: { student: AdminStudent; onDone: () => void }) {
  const t = useTranslations("admin.students");
  const toast = useToast();
  const [reason, setReason] = useState("");
  const cancel = useMutation(cancelStudentSubscription);
  const error = useErrorMessage(cancel.error);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (reason.trim().length < 3) return;
        if (await cancel.run(student.id, reason.trim())) {
          toast(t("cancelled"));
          onDone();
        }
      }}
      className="flex flex-col gap-3"
    >
      <Banner tone="warning">{t("cancelWarning", { name: student.name })}</Banner>
      <Field label={t("reason")}>{(props) => <Textarea {...props} value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} />}</Field>
      {error && <Banner tone="danger">{error}</Banner>}
      <Button type="submit" variant="danger" disabled={reason.trim().length < 3} loading={cancel.pending}>
        {t("cancelSubscription")}
      </Button>
    </form>
  );
}
