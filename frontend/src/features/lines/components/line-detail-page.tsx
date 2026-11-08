"use client";

import { ArrowLeft, MapPinOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tone } from "@/components/ui/tone";
import { getMySubscription } from "@/features/subscriptions/api";
import { BOOKABLE_STATUSES } from "@/features/subscriptions/schema";
import { isApiError } from "@/lib/api/errors";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { getLine } from "../api";
import { LineErrorCode } from "../schema";
import { BookingPanel } from "./booking-panel";
import { BusDriverCard } from "./bus-driver-card";
import { LineFacts } from "./line-facts";
import { StopList } from "./stop-list";

/** One line: its stops and times, and booking a seat at the chosen stop. */
export function LineDetailPage({ lineId }: { lineId: string }) {
  const t = useTranslations("student");
  const line = useAsync((signal) => getLine(lineId, { signal }), [lineId]);
  const mine = useAsync((signal) => getMySubscription({ signal }), []);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);

  const back = (
    <ButtonLink
      href="/student/lines"
      variant="ghost"
      size="sm"
      className="-ms-3 self-start"
      iconStart={<ArrowLeft className="size-4 rtl:-scale-x-100" />}
    >
      {t("line.back")}
    </ButtonLink>
  );

  if (line.status === AsyncStatus.Loading || mine.status === AsyncStatus.Loading) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (line.status === AsyncStatus.Error) {
    const missing = isApiError(line.error) && line.error.code === LineErrorCode.LineNotFound;
    return (
      <div className="flex flex-col gap-6">
        {back}
        {missing ? (
          <EmptyState
            headingLevel={1}
            title={t("line.notFoundTitle")}
            description={t("line.notFoundBody")}
            action={<ButtonLink href="/student/lines">{t("line.back")}</ButtonLink>}
          />
        ) : (
          <ErrorState error={line.error} onRetry={line.reload} headingLevel={1} />
        )}
      </div>
    );
  }
  if (mine.status === AsyncStatus.Error) {
    return <ErrorState error={mine.error} onRetry={mine.reload} />;
  }

  const current = mine.data.subscription;
  const canBook =
    (current === null || BOOKABLE_STATUSES.includes(current.status)) &&
    line.data.seats_available > 0;
  const ownStopId = current && current.line.line_id === lineId ? current.stop.stop_id : null;

  return (
    <div className="flex flex-col gap-6">
      {back}
      <PageHeader
        eyebrow={<Badge tone={Tone.Brand}>{t("lineCode", { code: line.data.code })}</Badge>}
        title={line.data.name}
      />
      <LineFacts line={line.data} />
      <div className="grid items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader
            title={t("line.stopsTitle")}
            description={canBook ? t("line.stopsLead") : t("line.stopsLeadReadOnly")}
          />
          <CardBody className="flex flex-col gap-3">
            <StopList
              stops={line.data.stops}
              highlightedId={ownStopId}
              selectable={
                canBook
                  ? { name: "stop", selectedId: selectedStopId, onSelect: setSelectedStopId }
                  : undefined
              }
            />
            <p className="flex items-center gap-2 text-caption text-ink-muted">
              <MapPinOff aria-hidden="true" className="size-4 shrink-0" />
              {t("line.noLocation")}
            </p>
          </CardBody>
        </Card>
        <div className="flex flex-col gap-5 desktop:sticky desktop:top-24">
          <BusDriverCard bus={line.data.bus} />
          <BookingPanel
            line={line.data}
            selectedStopId={selectedStopId}
            current={current}
            onBooked={mine.refresh}
          />
        </div>
      </div>
    </div>
  );
}
