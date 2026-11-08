"use client";

import { Check, ListChecks, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { TextAreaField } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Tone } from "@/components/ui/tone";
import { firstNameOf } from "@/features/auth/user-text";
import type { Locale } from "@/i18n/routing";
import { formatCalendarDate, formatDateTime } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { useSubmit } from "@/lib/hooks/use-submit";
import { approveAsGuardian, listGuardianApprovals, refuseAsGuardian } from "../api";
import {
  RequestActor,
  RequestErrorCode,
  RequestKind,
  RequestStatus,
  type GuardianApproval,
  type LineChangeRequest,
} from "../schema";
import { RequestStatusBadge } from "./request-status-badge";

const DECISION_ERRORS = [RequestErrorCode.NotAwaitingGuardian] as const;
const NOTE_MAX_LENGTH = 300;

/**
 * The guardian's approvals: a child's line change reaches the Transportation office only after
 * the guardian approves it here. Answered ones stay below for reference.
 */
export function GuardianApprovalsPage() {
  const t = useTranslations("parent.approvals");
  const state = useAsync((signal) => listGuardianApprovals({ signal }), []);

  let content: ReactNode;
  if (state.status === AsyncStatus.Loading) {
    content = <Skeleton className="h-64 w-full" />;
  } else if (state.status === AsyncStatus.Error) {
    content = <ErrorState error={state.error} onRetry={state.reload} />;
  } else {
    const lineChanges = state.data.approvals.filter(
      (item): item is GuardianApproval & { request: LineChangeRequest } =>
        item.request.kind === RequestKind.LineChange,
    );
    const waiting = lineChanges.filter(
      (item) => item.request.status === RequestStatus.AwaitingGuardian,
    );
    const answered = lineChanges.filter(
      (item) => item.request.status !== RequestStatus.AwaitingGuardian,
    );
    content = (
      <div className="flex flex-col gap-6">
        <section aria-labelledby="approvals-waiting" className="flex flex-col gap-3">
          <h2 id="approvals-waiting" className="text-h3 text-ink-strong">
            {t("waitingTitle")}
          </h2>
          {waiting.length === 0 ? (
            <EmptyState
              icon={<ListChecks />}
              title={t("emptyTitle")}
              description={t("emptyBody")}
            />
          ) : (
            waiting.map((item) => (
              <ApprovalCard key={item.request.request_id} item={item} onAnswered={state.refresh} />
            ))
          )}
        </section>
        {answered.length > 0 ? (
          <section aria-labelledby="approvals-answered" className="flex flex-col gap-3">
            <h2 id="approvals-answered" className="text-h3 text-ink-strong">
              {t("answeredTitle")}
            </h2>
            {answered.map((item) => (
              <ApprovalCard key={item.request.request_id} item={item} onAnswered={state.refresh} />
            ))}
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("lead")} />
      {content}
    </div>
  );
}

const Decision = { Approve: "approve", Refuse: "refuse" } as const;
type Decision = (typeof Decision)[keyof typeof Decision];

function ApprovalCard({
  item,
  onAnswered,
}: {
  item: GuardianApproval & { request: LineChangeRequest };
  onAnswered: () => void;
}) {
  const t = useTranslations("parent.approvals");
  const tStudent = useTranslations("student");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const toast = useToast();
  const { request } = item;
  const details = request.details;
  const name = firstNameOf(item.student_name);
  const isWaiting = request.status === RequestStatus.AwaitingGuardian;
  const guardianEvent = request.timeline.find((event) => event.by === RequestActor.Guardian);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const { submit, isSending, serverError, clearServerError } = useSubmit(DECISION_ERRORS);

  const lineLabel = (line: { code: string; name: string }) =>
    `${tStudent("lineCode", { code: line.code })} · ${line.name}`;
  const day = (value: string) => formatCalendarDate(value, locale);

  function close() {
    setDecision(null);
    setNote("");
    clearServerError();
  }

  async function answer() {
    if (!decision) return;
    const body = { note: note.trim() || null };
    const send = decision === Decision.Approve ? approveAsGuardian : refuseAsGuardian;
    const done = await submit((idempotencyKey) =>
      send(request.request_id, body, { idempotencyKey }),
    );
    if (done) {
      toast.show({
        title: decision === Decision.Approve ? t("approvedToast") : t("refusedToast"),
        description: decision === Decision.Approve ? t("approvedToastBody", { name }) : undefined,
        tone: decision === Decision.Approve ? Tone.Success : Tone.Info,
      });
      close();
      onAnswered();
    }
  }

  return (
    <Card elevation={isWaiting ? "raised" : undefined}>
      <CardHeader
        title={t("cardTitle", { name: item.student_name })}
        description={t("cardMeta", {
          reference: request.reference,
          date: formatDateTime(request.submitted_at, locale),
        })}
        actions={<RequestStatusBadge status={request.status} />}
      />
      <CardBody className="flex flex-col gap-4">
        <dl className="flex flex-col divide-y divide-line">
          <Row label={t("from")}>{lineLabel(details.from_line)}</Row>
          <Row label={t("to")}>
            {lineLabel(details.to_line)}
            <span className="block font-normal text-ink">
              {t("stop", { stop: details.to_stop.name })}
            </span>
          </Row>
          <Row label={t("duration")}>
            {details.ends_on
              ? tStudent("requests.lineChange.temporaryRange", {
                  from: day(details.starts_on),
                  to: day(details.ends_on),
                })
              : tStudent("requests.lineChange.permanentFrom", { from: day(details.starts_on) })}
          </Row>
          <Row label={t("reason", { name })}>{details.reason}</Row>
        </dl>

        {isWaiting ? (
          <div className="flex flex-col gap-3">
            <p className="text-body-sm text-ink">{t("explain", { name })}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                iconStart={<Check className="size-4" />}
                onClick={() => setDecision(Decision.Approve)}
              >
                {t("approve")}
              </Button>
              <Button
                variant="secondary"
                iconStart={<X className="size-4" />}
                onClick={() => setDecision(Decision.Refuse)}
              >
                {t("refuse")}
              </Button>
            </div>
          </div>
        ) : guardianEvent ? (
          <Alert
            tone={guardianEvent.status === RequestStatus.Rejected ? Tone.Info : Tone.Success}
            title={
              guardianEvent.status === RequestStatus.Rejected
                ? t("youRefused", { date: formatDateTime(guardianEvent.at, locale) })
                : t("youApproved", { date: formatDateTime(guardianEvent.at, locale) })
            }
          >
            {guardianEvent.note ?? null}
          </Alert>
        ) : null}
      </CardBody>

      <Dialog
        open={decision !== null}
        onClose={close}
        title={decision === Decision.Approve ? t("approveTitle") : t("refuseTitle")}
        description={
          decision === Decision.Approve
            ? t("approveBody", { name, line: lineLabel(details.to_line) })
            : t("refuseBody", { name })
        }
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={isSending}>
              {t("back")}
            </Button>
            <Button
              variant={decision === Decision.Refuse ? "danger" : "primary"}
              onClick={answer}
              isLoading={isSending}
            >
              {decision === Decision.Approve ? t("approveConfirm") : t("refuseConfirm")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <TextAreaField
            label={decision === Decision.Refuse ? t("refuseNote", { name }) : t("approveNote")}
            optionalText={tCommon("optional")}
            rows={3}
            maxLength={NOTE_MAX_LENGTH}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          {serverError ? <Alert tone={Tone.Danger} title={t(`errors.${serverError}`)} /> : null}
        </div>
      </Dialog>
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
