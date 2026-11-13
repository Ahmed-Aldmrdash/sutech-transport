"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { BackLink } from "@/components/ui/back-link";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { getRequest } from "../api";
import { OPEN_REQUEST_STATUSES, WITHDRAWABLE_REQUEST_STATUSES } from "../schema";
import { useRequestTitle } from "./request-list";
import { RequestStatusBadge } from "./request-status-badge";
import { RequestDetails } from "./request-details";
import { LatestAnswer, Timeline } from "./request-timeline";
import { WithdrawCard } from "./withdraw-card";

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
      <div className="grid grid-cols-1 items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
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
