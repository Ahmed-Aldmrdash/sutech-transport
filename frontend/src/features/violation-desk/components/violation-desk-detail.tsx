"use client";

import { Camera } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { BackLink } from "@/components/ui/back-link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { FilePreview } from "@/components/ui/file-preview";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tone } from "@/components/ui/tone";
import { Fact } from "@/features/emergencies/components/sos-facts";
import { CONDUCT_RULE_NUMBER, ViolationStatus } from "@/features/violations/schema";
import type { Locale } from "@/i18n/routing";
import { formatDateTime } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { getDeskViolation } from "../api";
import type { DeskViolation } from "../schema";
import { ViolationBadge } from "./violation-badge";
import { ViolationDecisionCard } from "./violation-decision-card";

/** One reported violation: what the crew saw, and Student Affairs' decision. */
export function ViolationDeskDetail({ violationId }: { violationId: string }) {
  const t = useTranslations();
  const state = useAsync((signal) => getDeskViolation(violationId, { signal }), [violationId]);
  const back = <BackLink href="/admin/violations">{t("desk.violations.back")}</BackLink>;

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
  const item = state.data;
  const number = CONDUCT_RULE_NUMBER[item.rule];
  return (
    <div className="flex flex-col gap-6">
      {back}
      <PageHeader
        eyebrow={
          number === null
            ? t("desk.violations.detail.eyebrowOther")
            : t("desk.violations.detail.eyebrow", { number })
        }
        title={t(`violations.rules.${item.rule}`)}
        actions={<ViolationBadge status={item.status} />}
      />
      <Decision item={item} />
      <div className="grid grid-cols-1 items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Report item={item} />
        <div className="flex flex-col gap-5">
          {item.allowed_actions.length > 0 ? (
            <ViolationDecisionCard item={item} onDone={state.refresh} />
          ) : item.status !== ViolationStatus.Closed ? (
            <Alert tone={Tone.Info} title={t("desk.violations.detail.readOnly")} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Decision({ item }: { item: DeskViolation }) {
  const t = useTranslations("desk.violations");
  const locale = useLocale() as Locale;
  if (!item.decision) {
    return item.opened_by_name ? (
      <Alert tone={Tone.Info} title={t("detail.openedBy", { name: item.opened_by_name })} />
    ) : null;
  }
  return (
    <Alert
      tone={Tone.Success}
      title={t("detail.closedTitle", { outcome: t(`outcomes.${item.decision.outcome}.label`) })}
    >
      <span className="block">{item.decision.note}</span>
      <span className="mt-1 block text-caption">
        {t("detail.decidedBy", {
          name: item.decision.by_name,
          time: formatDateTime(item.decision.at, locale),
        })}
      </span>
    </Alert>
  );
}

function Report({ item }: { item: DeskViolation }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  return (
    <Card elevation="raised">
      <CardHeader title={t("desk.violations.detail.report")} headingLevel={2} />
      <CardBody className="flex flex-col gap-4">
        <p className="text-body text-ink">{item.description}</p>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Fact label={t("desk.violations.detail.student")}>
            {item.student ? (
              <>
                {item.student.name} · <bdi>{item.student.identifier}</bdi>
              </>
            ) : (
              t("desk.violations.unknownStudent")
            )}
          </Fact>
          <Fact label={t("desk.violations.detail.line")}>
            {item.line
              ? t("desk.violations.lineValue", { code: item.line.code, name: item.line.name })
              : "—"}
          </Fact>
          <Fact label={t("desk.violations.detail.reportedBy")}>
            {t("desk.violations.reportedByValue", {
              name: item.reported_by.name,
              role: t(`roles.${item.reported_by.role}`),
            })}
          </Fact>
          <Fact label={t("desk.violations.detail.when")}>
            {formatDateTime(item.created_at, locale)}
          </Fact>
          <Fact label={t("desk.violations.detail.photo")} icon={<Camera />}>
            {item.photo_url ? (
              <FilePreview
                url={item.photo_url}
                name={item.photo_name}
                contentType="image/jpeg"
                alt={t("desk.violations.detail.photoAlt")}
              />
            ) : (
              <bdi>{item.photo_name}</bdi>
            )}
          </Fact>
        </dl>
      </CardBody>
    </Card>
  );
}
