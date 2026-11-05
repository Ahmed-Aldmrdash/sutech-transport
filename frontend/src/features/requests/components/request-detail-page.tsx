"use client";

import { Paperclip } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tone } from "@/components/ui/tone";
import { useToast } from "@/components/ui/toast";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import {
  formatCalendarDate,
  formatClockTime,
  formatDateTime,
  formatFileSize,
  formatMoney,
} from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { getRequest, withdrawRequest } from "../api";
import {
  OPEN_REQUEST_STATUSES,
  RequestActor,
  WITHDRAWABLE_REQUEST_STATUSES,
  RequestErrorCode,
  RequestKind,
  RequestStatus,
  type Attachment,
  type RequestEvent,
  type StudentRequest,
} from "../schema";
import { useRequestTitle } from "./request-list";
import { REQUEST_STATUS_TONE, RequestStatusBadge } from "./request-status-badge";
import { useSubmit } from "@/lib/hooks/use-submit";

/** While the office is working on it, check for news this often. */
const REFRESH_MS = 10_000;

/** One request: the office's answer, the history, what was asked, and "withdraw" while new. */
export function RequestDetailPage({
  requestId,
  backHref,
  backLabel,
}: {
  requestId: string;
  backHref: string;
  backLabel: string;
}) {
  const t = useTranslations("student.requests");
  const state = useAsync((signal) => getRequest(requestId, { signal }), [requestId]);
  const titleOf = useRequestTitle();
  const isOpen =
    state.status === AsyncStatus.Success && OPEN_REQUEST_STATUSES.includes(state.data.status);
  const { refresh } = state;

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setInterval(refresh, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [isOpen, refresh]);

  const back = <BackLink href={backHref}>{backLabel}</BackLink>;

  if (state.status === AsyncStatus.Loading) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (state.status === AsyncStatus.Error) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <ErrorState error={state.error} onRetry={state.reload} />
      </div>
    );
  }

  const request = state.data;
  return (
    <div className="flex flex-col gap-6">
      {back}
      <PageHeader
        eyebrow={`${t(`kinds.${request.kind}`)} · ${request.reference}`}
        title={titleOf(request)}
        actions={<RequestStatusBadge status={request.status} />}
      />
      <LatestAnswer request={request} />
      <div className="grid items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <RequestDetails request={request} />
        <div className="flex flex-col gap-5">
          <Timeline events={request.timeline} />
          {WITHDRAWABLE_REQUEST_STATUSES.includes(request.status) ? (
            <WithdrawCard request={request} onWithdrawn={state.refresh} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** The office's last word, on top where the student looks first. */
function LatestAnswer({ request }: { request: StudentRequest }) {
  const t = useTranslations("student.requests.detail");
  const last = request.timeline.at(-1);
  if (last?.status === RequestStatus.Withdrawn) {
    return <Alert tone={Tone.Info} title={t("answer.withdrawn")} />;
  }
  if (request.status === RequestStatus.AwaitingGuardian) {
    return (
      <Alert tone={Tone.Warning} title={t("guardianWaitingTitle")}>
        {t("guardianWaitingBody")}
      </Alert>
    );
  }
  if (!last || last.by === RequestActor.Student || request.status === RequestStatus.Submitted) {
    return request.status === RequestStatus.Submitted ? (
      <Alert tone={Tone.Info} title={t("waitingTitle")}>
        {t("waitingBody")}
      </Alert>
    ) : null;
  }
  if (last.by === RequestActor.Guardian) {
    return (
      <Alert tone={Tone.Danger} title={t("guardianRefused")}>
        {last.note ?? null}
      </Alert>
    );
  }
  const tone = REQUEST_STATUS_TONE[last.status];
  const alertTone =
    tone === Tone.Success || tone === Tone.Danger || tone === Tone.Warning ? tone : Tone.Info;
  return (
    <Alert tone={alertTone} title={t(`answer.${last.status}`)}>
      {last.note ?? t("noNote")}
    </Alert>
  );
}

function Timeline({ events }: { events: readonly RequestEvent[] }) {
  const t = useTranslations("student.requests");
  const locale = useLocale() as Locale;
  return (
    <Card>
      <CardHeader title={t("detail.historyTitle")} />
      <CardBody>
        <ol className="flex flex-col">
          {events.map((event, index) => {
            const isLast = index === events.length - 1;
            return (
              <li
                key={`${event.status}-${event.at}`}
                className="relative flex gap-3 pb-5 last:pb-0"
              >
                {!isLast ? (
                  <span
                    aria-hidden="true"
                    className="absolute start-[7px] top-5 bottom-0 w-0.5 bg-line"
                  />
                ) : null}
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-1 size-4 shrink-0 rounded-full border-2",
                    isLast ? "border-brand bg-brand" : "border-line-strong bg-surface-raised",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-bold text-ink-strong">
                    {event.by === RequestActor.Guardian
                      ? t(
                          event.status === RequestStatus.Rejected
                            ? "detail.guardianRefused"
                            : "detail.guardianApproved",
                        )
                      : t(`status.${event.status}`)}
                  </p>
                  <p className="text-caption text-ink-muted">
                    {t("detail.eventMeta", {
                      by: t(`detail.by.${event.by}`),
                      date: formatDateTime(event.at, locale),
                    })}
                  </p>
                  {event.note ? <p className="mt-1 text-body-sm text-ink">{event.note}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      </CardBody>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:gap-4">
      <dt className="text-body-sm text-ink-muted sm:w-40 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 text-body-sm font-bold break-words text-ink-strong">{children}</dd>
    </div>
  );
}

function Attachments({ items }: { items: readonly Attachment[] }) {
  const locale = useLocale() as Locale;
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.attachment_id} className="flex items-center gap-2 font-normal">
          <Paperclip aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
          <span className="truncate" dir="ltr">
            {item.file_name}
          </span>
          <span className="shrink-0 text-ink-muted">
            ({formatFileSize(item.size_bytes, locale)})
          </span>
        </li>
      ))}
    </ul>
  );
}

/** What the student asked for, field by field. */
function RequestDetails({ request }: { request: StudentRequest }) {
  const t = useTranslations("student");
  const locale = useLocale() as Locale;
  const lineLabel = (line: { code: string; name: string }) =>
    `${t("lineCode", { code: line.code })} · ${line.name}`;
  const day = (value: string) => formatCalendarDate(value, locale);

  let rows: ReactNode;
  switch (request.kind) {
    case RequestKind.LineChange: {
      const details = request.details;
      rows = (
        <>
          <Row label={t("requests.lineChange.fromLine")}>{lineLabel(details.from_line)}</Row>
          <Row label={t("requests.lineChange.toLine")}>{lineLabel(details.to_line)}</Row>
          <Row label={t("requests.lineChange.toStop")}>{details.to_stop.name}</Row>
          <Row label={t("requests.lineChange.duration")}>
            {details.ends_on
              ? t("requests.lineChange.temporaryRange", {
                  from: day(details.starts_on),
                  to: day(details.ends_on),
                })
              : t("requests.lineChange.permanentFrom", { from: day(details.starts_on) })}
          </Row>
          <Row label={t("requests.lineChange.reason")}>{details.reason}</Row>
          <Row label={t("requests.lineChange.studentPhone")}>
            <span dir="ltr">{details.student_phone}</span>
          </Row>
          <Row label={t("requests.guardian.name")}>{details.guardian_name}</Row>
          <Row label={t("requests.guardian.phone")}>
            <span dir="ltr">{details.guardian_phone}</span>
          </Row>
        </>
      );
      break;
    }
    case RequestKind.Refund: {
      const details = request.details;
      rows = (
        <>
          <Row label={t("requests.refund.reason")}>
            {t(`requests.refund.reasons.${details.reason}.label`)}
          </Row>
          <Row label={t("requests.refund.explanation")}>{details.explanation}</Row>
          <Row label={t("requests.refund.paid")}>{formatMoney(details.paid_piasters, locale)}</Row>
          <Row label={t("requests.refund.deduction")}>
            {t("requests.refund.percent", { percent: details.deduction_percent })}
          </Row>
          <Row label={t("requests.refund.estimate")}>
            {details.estimated_refund_piasters === null
              ? t("requests.refund.decidedByUniversity")
              : formatMoney(details.estimated_refund_piasters, locale)}
          </Row>
          <Row label={t("requests.guardian.name")}>{details.guardian_name}</Row>
          <Row label={t("requests.guardian.phone")}>
            <span dir="ltr">{details.guardian_phone}</span>
          </Row>
          {details.attachments.length > 0 ? (
            <Row label={t("requests.refund.documents")}>
              <Attachments items={details.attachments} />
            </Row>
          ) : null}
        </>
      );
      break;
    }
    case RequestKind.Complaint: {
      const details = request.details;
      rows = (
        <>
          <Row label={t("requests.complaint.category")}>
            {t(`requests.complaint.categories.${details.category}`)}
          </Row>
          <Row label={t("requests.complaint.line")}>
            {details.line ? lineLabel(details.line) : t("requests.complaint.noLine")}
          </Row>
          <Row label={t("requests.complaint.happenedOn")}>{day(details.happened_on)}</Row>
          <Row label={t("requests.complaint.description")}>{details.description}</Row>
          {details.attachments.length > 0 ? (
            <Row label={t("requests.complaint.attachments")}>
              <Attachments items={details.attachments} />
            </Row>
          ) : null}
        </>
      );
      break;
    }
    case RequestKind.ModelPermit: {
      const details = request.details;
      const p = "requests.modelPermit";
      const moment = (date: string, time: string) =>
        t(`${p}.moment`, { date: day(date), time: formatClockTime(time, locale) });
      rows = (
        <>
          <Row label={t(`${p}.studentName`)}>{details.student_name}</Row>
          <Row label={t(`${p}.universityId`)}>
            <span dir="ltr">{details.university_id}</span>
          </Row>
          {details.faculty ? <Row label={t(`${p}.faculty`)}>{details.faculty}</Row> : null}
          {details.level ? (
            <Row label={t(`${p}.level`)}>{t(`${p}.levelValue`, { level: details.level })}</Row>
          ) : null}
          <Row label={t(`${p}.line`)}>{lineLabel(details.line)}</Row>
          <Row label={t(`${p}.busType`)}>{t(`busType.${details.bus_type}`)}</Row>
          <Row label={t(`${p}.driver`)}>
            {details.driver_name ? (
              <>
                {details.driver_name}
                {details.driver_phone ? (
                  <>
                    {" · "}
                    <span dir="ltr">{details.driver_phone}</span>
                  </>
                ) : null}
              </>
            ) : (
              t(`${p}.driverPending`)
            )}
          </Row>
          <Row label={t(`${p}.material`)}>{details.material}</Row>
          <Row label={t(`${p}.dimensions`)}>{details.dimensions}</Row>
          <Row label={t(`${p}.purpose`)}>
            {details.purpose_other
              ? `${t(`${p}.purposes.${details.purpose}`)}: ${details.purpose_other}`
              : t(`${p}.purposes.${details.purpose}`)}
          </Row>
          <Row label={t(`${p}.destination`)}>{details.destination}</Row>
          <Row label={t(`${p}.entry`)}>{moment(details.entry_date, details.entry_time)}</Row>
          <Row label={t(`${p}.exit`)}>{moment(details.exit_date, details.exit_time)}</Row>
          <Row label={t(`${p}.supervisorName`)}>{details.supervisor_name}</Row>
          <Row label={t(`${p}.declarationTitle`)}>{t(`${p}.declarationAccepted`)}</Row>
        </>
      );
      break;
    }
  }

  return (
    <Card>
      <CardHeader title={t("requests.detail.detailsTitle")} />
      <CardBody>
        <dl className="flex flex-col divide-y divide-line">
          <Row label={t("requests.detail.submittedAt")}>
            {formatDateTime(request.submitted_at, locale)}
          </Row>
          {rows}
        </dl>
      </CardBody>
    </Card>
  );
}

function WithdrawCard({
  request,
  onWithdrawn,
}: {
  request: StudentRequest;
  onWithdrawn: () => void;
}) {
  const t = useTranslations("student.requests.detail");
  const toast = useToast();
  const [isConfirming, setIsConfirming] = useState(false);
  const { submit, isSending, serverError } = useSubmit([RequestErrorCode.NotWithdrawable]);

  async function confirm() {
    const result = await submit((idempotencyKey) =>
      withdrawRequest(request.request_id, { idempotencyKey }),
    );
    setIsConfirming(false);
    if (result) {
      toast.show({ title: t("withdrawn"), tone: Tone.Success });
      onWithdrawn();
    }
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <p className="text-body-sm text-ink">{t("withdrawHint")}</p>
        {serverError ? (
          <Alert tone={Tone.Danger} title={t(`withdrawErrors.${serverError}`)} />
        ) : null}
        <Button variant="secondary" className="self-start" onClick={() => setIsConfirming(true)}>
          {t("withdraw")}
        </Button>
      </CardBody>
      <ConfirmDialog
        open={isConfirming}
        onClose={() => setIsConfirming(false)}
        onConfirm={() => void confirm()}
        title={t("withdrawConfirmTitle")}
        description={t("withdrawConfirmBody", { reference: request.reference })}
        confirmLabel={t("withdrawConfirm")}
        cancelLabel={t("keep")}
        destructive
        isConfirming={isSending}
      />
    </Card>
  );
}
