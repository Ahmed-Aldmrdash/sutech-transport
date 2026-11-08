"use client";

import { UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { TripRow } from "@/features/attendance/components/trip-row";
import { firstNameOf } from "@/features/auth/user-text";
import { BusDriverCard } from "@/features/lines/components/bus-driver-card";
import { AsyncStatus } from "@/lib/hooks/use-async";
import type { Child } from "../schema";
import { ChildSwitcher } from "./child-switcher";
import { useChildren } from "./children-provider";
import { DayStatusBanner, DayTimeline } from "./day-status";
import { DaysOffList } from "./days-off-list";
import { useChildDay } from "./use-child-day";

/** "Today's trip": where the child is, what happened so far, the bus, and the last few days. */
export function ChildDayPage() {
  const t = useTranslations("parent");
  const { selected } = useChildren();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("day.title")} description={t("day.lead")} />
      <ChildSwitcher />
      {selected ? (
        <ChildDay key={selected.student_id} child={selected} />
      ) : (
        <EmptyState
          icon={<UsersRound />}
          title={t("noChildrenTitle")}
          description={t("noChildrenBody")}
        />
      )}
    </div>
  );
}

function ChildDay({ child }: { child: Child }) {
  const t = useTranslations("parent.day");
  const state = useChildDay(child.student_id);

  if (state.status === AsyncStatus.Loading) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (state.status === AsyncStatus.Error) {
    return <ErrorState error={state.error} onRetry={state.reload} />;
  }

  const day = state.data;
  return (
    <div className="grid items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-5">
        <DayStatusBanner day={day} childName={child.name} />
        <DaysOffList day={day} />
        <Card>
          <CardHeader title={t("timelineTitle")} />
          <CardBody>
            <DayTimeline events={day.events} />
          </CardBody>
        </Card>
        {day.recent.length > 0 ? (
          <Card>
            <CardHeader
              title={t("recentTitle")}
              description={t("recentLead", { name: firstNameOf(child.name) })}
            />
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {day.recent.map((record) => (
                <TripRow key={record.trip_id} item={record} />
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
      {day.trip ? <BusDriverCard bus={day.trip.bus} /> : null}
    </div>
  );
}
