"use client";

import {
  ArrowLeftRight,
  ClipboardList,
  MessageSquareWarning,
  Package,
  ReceiptText,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { listMyRequests } from "../api";
import { RequestKind, type StudentRequest } from "../schema";
import { RequestList } from "./request-list";

export const REQUESTS_PATH = "/student/requests";
export const COMPLAINTS_PATH = "/student/complaints";

/** Loads the student's requests and shows loading, error, empty or the list. */
function RequestsView({
  header,
  filter,
  basePath,
  empty,
}: {
  header: ReactNode;
  filter: (request: StudentRequest) => boolean;
  basePath: string;
  empty: ReactNode;
}) {
  const state = useAsync((signal) => listMyRequests(undefined, { signal }), []);
  const shown = state.status === AsyncStatus.Success ? state.data.filter(filter) : [];
  return (
    <div className="flex flex-col gap-6">
      {header}
      {state.status === AsyncStatus.Loading ? <Skeleton className="h-48 w-full" /> : null}
      {state.status === AsyncStatus.Error ? (
        <ErrorState error={state.error} onRetry={state.reload} />
      ) : null}
      {state.status === AsyncStatus.Success && shown.length === 0 ? empty : null}
      {shown.length > 0 ? <RequestList requests={shown} basePath={basePath} /> : null}
    </div>
  );
}

/** Line change, refund and model permit requests, with buttons to start each. */
export function RequestsPage() {
  const t = useTranslations("student.requests");
  const actions = (
    <>
      <ButtonLink
        href={`${REQUESTS_PATH}/new/line-change`}
        iconStart={<ArrowLeftRight className="size-4" />}
      >
        {t("lineChange.new")}
      </ButtonLink>
      <ButtonLink
        href={`${REQUESTS_PATH}/new/refund`}
        variant="secondary"
        iconStart={<ReceiptText className="size-4" />}
      >
        {t("refund.new")}
      </ButtonLink>
      <ButtonLink
        href={`${REQUESTS_PATH}/new/model-permit`}
        variant="secondary"
        iconStart={<Package className="size-4" />}
      >
        {t("modelPermit.new")}
      </ButtonLink>
    </>
  );
  return (
    <RequestsView
      header={<PageHeader title={t("title")} description={t("lead")} actions={actions} />}
      filter={(request) => request.kind !== RequestKind.Complaint}
      basePath={REQUESTS_PATH}
      empty={
        <EmptyState
          icon={<ClipboardList />}
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={
            <ButtonLink href={COMPLAINTS_PATH} variant="secondary">
              {t("complaint.goToComplaints")}
            </ButtonLink>
          }
        />
      }
    />
  );
}

/** The student's complaints and their answers. */
export function ComplaintsPage() {
  const t = useTranslations("student.requests.complaint");
  const newComplaint = (
    <ButtonLink
      href={`${COMPLAINTS_PATH}/new`}
      iconStart={<MessageSquareWarning className="size-4" />}
    >
      {t("new")}
    </ButtonLink>
  );
  return (
    <RequestsView
      header={<PageHeader title={t("title")} description={t("lead")} actions={newComplaint} />}
      filter={(request) => request.kind === RequestKind.Complaint}
      basePath={COMPLAINTS_PATH}
      empty={
        <EmptyState
          icon={<MessageSquareWarning />}
          title={t("emptyTitle")}
          description={t("emptyBody")}
        />
      }
    />
  );
}
