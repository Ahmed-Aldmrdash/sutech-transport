"use client";

import type { ReactNode } from "react";
import { Check, Circle, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Banner } from "@/components/ui/Banner";
import { Card } from "@/components/ui/Card";
import { Pill, type Tone } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/time";
import type { StudentRequest } from "../schema";

const STATUS_TONE: Record<StudentRequest["status"], Tone> = { open: "warning", approved: "success", rejected: "danger" };

/** One request with its approval path (parent → transport → finance) and the facts each reviewer needs. */
export function RequestCard({ request, showStudent = false, actions }: { request: StudentRequest; showStudent?: boolean; actions?: ReactNode }) {
  const t = useTranslations("requests");
  const locale = useLocale();
  const { details } = request;
  return (
    <Card as="article" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-ink-strong">
          {t(`type.${details.type}`)} <span className="num text-[13px] font-normal text-ink-muted">#{request.id}</span>
        </h3>
        <Pill tone={STATUS_TONE[request.status]}>{t(`status.${request.status}`)}</Pill>
      </div>
      {showStudent && (
        <p className="text-[14px] text-ink-muted">
          {request.student_name} · <span className="num">{request.student_id}</span>
        </p>
      )}
      <dl className="grid gap-1 text-[14px]">
        {details.type === "refund" && (
          <>
            <Fact label={t("paid")} value={formatMoney(details.paid, locale)} />
            <Fact label={t("week")} value={t("weekValue", { week: details.week, percent: details.deduction_percent })} />
            <Fact label={t("refundAmount")} value={formatMoney(details.refund_amount, locale)} strong />
          </>
        )}
        {details.type === "line_change" && (
          <>
            <Fact label={t("toLine")} value={details.to_line_name} />
            <Fact label={t("kind")} value={details.until ? t("temporaryUntil", { date: formatDate(details.until, locale) }) : t(`kinds.${details.kind}`)} />
          </>
        )}
        {details.type === "project_model" && (
          <>
            <Fact label={t("date")} value={formatDate(details.date, locale)} />
            <Fact label={t("size")} value={details.size} />
          </>
        )}
        {details.type === "guardian_change" && <Fact label={t("field")} value={t(`fields.${details.field}`)} />}
      </dl>
      <p className="rounded-md bg-surface-alt p-3 text-[14px] text-ink">{request.reason}</p>
      <ol className="flex flex-wrap items-center gap-2 text-[13px]" aria-label={t("steps")}>
        {request.steps.map((step, index) => (
          <li key={step.actor} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden className="h-px w-4 bg-line-strong" />}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold",
                step.state === "done" && "bg-success-soft text-success-text",
                step.state === "current" && "bg-warning-soft text-warning-text",
                step.state === "waiting" && "bg-surface-alt text-ink-muted",
                step.state === "rejected" && "bg-danger-soft text-danger",
              )}
            >
              {step.state === "done" ? <Check className="size-3" aria-hidden /> : step.state === "rejected" ? <X className="size-3" aria-hidden /> : <Circle className="size-3" aria-hidden />}
              {t(`actor.${step.actor}`)}
              <span className="sr-only">: {t(`stepState.${step.state}`)}</span>
            </span>
          </li>
        ))}
      </ol>
      {request.rejection_reason && <Banner tone="danger" title={t("rejectedBecause")}>{request.rejection_reason}</Banner>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <time dateTime={request.created_at} className="text-[13px] text-ink-muted">
          {formatDateTime(request.created_at, locale)}
        </time>
        {actions}
      </div>
    </Card>
  );
}

function Fact({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={cn("text-end", strong ? "font-extrabold text-brand" : "font-bold text-ink-strong")}>{value}</dd>
    </div>
  );
}
