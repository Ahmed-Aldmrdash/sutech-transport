"use client";

import { useTranslations } from "next-intl";
import { BackLink } from "@/components/ui/back-link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { CallLink, Fact } from "@/features/emergencies/components/sos-facts";
import { RequestDetails } from "@/features/requests/components/request-details";
import { useRequestTitle } from "@/features/requests/components/request-list";
import { RequestStatusBadge } from "@/features/requests/components/request-status-badge";
import { Timeline } from "@/features/requests/components/request-timeline";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { getDeskRequest } from "../api";
import type { DeskRequest } from "../schema";
import { DeskActionsCard } from "./desk-actions-card";
import { sectionHref, type DeskSection } from "./desk-sections";

/** One request as the office sees it: what was asked, the student, the history, the answer. */
export function DeskRequestPage({
  section,
  requestId,
}: {
  section: DeskSection;
  requestId: string;
}) {
  const t = useTranslations("desk.requests");
  const titleOf = useRequestTitle();
  const state = useAsync((signal) => getDeskRequest(requestId, { signal }), [requestId]);
  const back = <BackLink href={sectionHref(section)}>{t(`sections.${section}.back`)}</BackLink>;

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
  const desk = state.data;
  const { request } = desk;
  return (
    <div className="flex flex-col gap-6">
      {back}
      <PageHeader
        eyebrow={`${t(`kinds.${request.kind}`)} · ${request.reference}`}
        title={titleOf(request)}
        actions={<RequestStatusBadge status={request.status} />}
      />
      <div className="grid grid-cols-1 items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-5">
          <RequestDetails request={request} title={t("detail.asked")} />
          <Timeline events={request.timeline} />
        </div>
        <div className="flex flex-col gap-5">
          {desk.allowed_actions.length > 0 ? (
            <DeskActionsCard desk={desk} onDone={state.refresh} />
          ) : null}
          <StudentCard desk={desk} />
        </div>
      </div>
    </div>
  );
}

function StudentCard({ desk }: { desk: DeskRequest }) {
  const t = useTranslations("desk.requests.detail");
  const { student } = desk;
  return (
    <Card>
      <CardHeader title={t("student")} headingLevel={2} />
      <CardBody>
        <dl className="flex flex-col gap-4">
          <Fact label={t("name")}>{student.name}</Fact>
          <Fact label={t("identifier")}>
            <bdi>{student.identifier}</bdi>
          </Fact>
          <Fact label={t("phone")}>
            <CallLink name={student.name} phone={student.phone} />
          </Fact>
          {student.faculty ? (
            <Fact label={t("faculty")}>
              {student.level
                ? t("facultyLevel", { faculty: student.faculty, level: student.level })
                : student.faculty}
            </Fact>
          ) : null}
          <Fact label={t("line")}>
            {student.line
              ? t("lineValue", { code: student.line.code, name: student.line.name })
              : t("noLine")}
          </Fact>
          {student.subscription_status ? (
            <Fact label={t("subscription")}>
              {t(`subscriptionStatus.${student.subscription_status}`)}
            </Fact>
          ) : null}
          {desk.handled_by_name ? <Fact label={t("handledBy")}>{desk.handled_by_name}</Fact> : null}
        </dl>
      </CardBody>
    </Card>
  );
}
