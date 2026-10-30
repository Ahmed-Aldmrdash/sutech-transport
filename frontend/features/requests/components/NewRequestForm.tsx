"use client";

import { type FormEvent, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { useErrorMessage } from "@/components/ui/States";
import { listLines } from "@/features/lines/api";
import type { Subscription } from "@/features/subscriptions/schema";
import { currentRefundTier } from "@/features/term/api";
import type { Term } from "@/features/term/schema";
import { useApi, useMutation } from "@/lib/api/use-api";
import { formatMoney, percentOf } from "@/lib/money";
import { cairoDate } from "@/lib/time";
import { createRequest } from "../api";
import { NewRequest, RequestType } from "../schema";
import { RefundPolicy } from "./RefundPolicy";

/** Only guardian changes are open to students without an active subscription. */
export function NewRequestForm({
  initialType,
  subscription,
  term,
  active,
  onDone,
}: {
  initialType: RequestType;
  subscription: Subscription;
  term: Term;
  active: boolean;
  onDone: () => void;
}) {
  const t = useTranslations("requests.form");
  const locale = useLocale();
  const [type, setType] = useState<RequestType>(active ? initialType : RequestType.GuardianChange);
  const [reason, setReason] = useState("");
  const [toLine, setToLine] = useState("");
  const [kind, setKind] = useState<"temporary" | "permanent">("temporary");
  const [until, setUntil] = useState("");
  const [date, setDate] = useState("");
  const [size, setSize] = useState("");
  const [field, setField] = useState<"phone" | "name" | "both">("phone");
  const [invalid, setInvalid] = useState(false);
  const lines = useApi(listLines);
  const create = useMutation(createRequest);
  const error = useErrorMessage(create.error);
  const today = cairoDate();
  const paid = subscription.paid_amount ?? subscription.price ?? 0;
  const tier = currentRefundTier(term.refund_policy, term.current.week);
  const deduction = tier?.deduction_percent ?? 0;

  function build() {
    if (type === RequestType.Refund) return { type, reason };
    if (type === RequestType.LineChange) return { type, reason, to_line_id: toLine, kind, until: kind === "temporary" ? until || null : null };
    if (type === RequestType.ProjectModel) return { type, reason, date, size };
    return { type, reason, field };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = NewRequest.safeParse(build());
    const missingUntil = type === RequestType.LineChange && kind === "temporary" && !until;
    if (!parsed.success || missingUntil) return setInvalid(true);
    setInvalid(false);
    if (await create.run(parsed.data)) onDone();
  }

  const otherLines = (lines.data?.items ?? []).filter((line) => line.id !== subscription.line_id);
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label={t("type")}>
        {(props) => (
          <Select {...props} value={type} onChange={(event) => setType(event.target.value as RequestType)}>
            {Object.values(RequestType).map((value) => (
              <option key={value} value={value} disabled={!active && value !== RequestType.GuardianChange}>
                {t(`types.${value}`)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {!active && <Banner tone="info">{t("onlyGuardian")}</Banner>}
      {type === RequestType.Refund && (
        <>
          <RefundPolicy policy={term.refund_policy} week={term.current.week} />
          <Banner tone="info" title={t("refundEstimate", { amount: formatMoney(percentOf(paid, 100 - deduction), locale) })}>
            {t("refundNote", { week: term.current.week, percent: deduction })}
          </Banner>
        </>
      )}
      {type === RequestType.LineChange && (
        <>
          <Field label={t("toLine")}>
            {(props) => (
              <Select {...props} value={toLine} onChange={(event) => setToLine(event.target.value)}>
                <option value="">{t("chooseLine")}</option>
                {otherLines.map((line) => (
                  <option key={line.id} value={line.id} disabled={line.seats_left === 0}>
                    {line.name} {line.seats_left === 0 ? `(${t("full")})` : ""}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t("kind")}>
            {(props) => (
              <Select {...props} value={kind} onChange={(event) => setKind(event.target.value as "temporary" | "permanent")}>
                <option value="temporary">{t("temporary")}</option>
                <option value="permanent">{t("permanent")}</option>
              </Select>
            )}
          </Field>
          {kind === "temporary" && (
            <Field label={t("until")}>{(props) => <Input {...props} type="date" min={today} value={until} onChange={(event) => setUntil(event.target.value)} />}</Field>
          )}
        </>
      )}
      {type === RequestType.ProjectModel && (
        <>
          <Field label={t("date")}>{(props) => <Input {...props} type="date" min={today} value={date} onChange={(event) => setDate(event.target.value)} />}</Field>
          <Field label={t("size")} hint={t("sizeHint")}>{(props) => <Input {...props} value={size} onChange={(event) => setSize(event.target.value)} />}</Field>
        </>
      )}
      {type === RequestType.GuardianChange && (
        <Field label={t("field")} hint={t("fieldHint")}>
          {(props) => (
            <Select {...props} value={field} onChange={(event) => setField(event.target.value as "phone" | "name" | "both")}>
              <option value="phone">{t("fields.phone")}</option>
              <option value="name">{t("fields.name")}</option>
              <option value="both">{t("fields.both")}</option>
            </Select>
          )}
        </Field>
      )}
      <Field label={t("reason")} error={invalid ? t("invalid") : undefined}>
        {(props) => <Textarea {...props} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />}
      </Field>
      {error && <Banner tone="danger">{error}</Banner>}
      <Button type="submit" loading={create.pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
