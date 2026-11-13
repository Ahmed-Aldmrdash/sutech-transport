"use client";

import { ListChecks } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { listGuardianApprovals } from "../api";
import { refreshAwaitingApprovals } from "../awaiting-approvals";
import {
  RequestKind,
  RequestStatus,
  type GuardianApproval,
  type LineChangeRequest,
} from "../schema";
import { ApprovalCard } from "./approval-card";

/**
 * The guardian's approvals: a child's line change reaches the Transportation office only after
 * the guardian approves it here. Answered ones stay below for reference.
 */
export function GuardianApprovalsPage() {
  const t = useTranslations("parent.approvals");
  const state = useAsync((signal) => listGuardianApprovals({ signal }), []);
  const onAnswered = () => {
    state.refresh();
    refreshAwaitingApprovals();
  };

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
              <ApprovalCard key={item.request.request_id} item={item} onAnswered={onAnswered} />
            ))
          )}
        </section>
        {answered.length > 0 ? (
          <section aria-labelledby="approvals-answered" className="flex flex-col gap-3">
            <h2 id="approvals-answered" className="text-h3 text-ink-strong">
              {t("answeredTitle")}
            </h2>
            {answered.map((item) => (
              <ApprovalCard key={item.request.request_id} item={item} onAnswered={onAnswered} />
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

export const Decision = { Approve: "approve", Refuse: "refuse" } as const;
export type Decision = (typeof Decision)[keyof typeof Decision];
