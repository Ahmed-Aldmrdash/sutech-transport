"use client";

import { BusFront, CalendarOff, FlaskConical } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/api/errors";
import { isMockMode } from "@/lib/config";
import { AsyncStatus } from "@/lib/hooks/use-async";
import { CrewErrorCode, type CrewToday } from "../schema";
import { startTestDay } from "../test-day";
import { useCrewToday } from "./use-crew-today";

interface CrewGateProps {
  /** The page itself, once today's trip is known. `refresh` re-reads it after an action. */
  children: (today: CrewToday, refresh: () => void) => ReactNode;
  /** Shown above the waiting states, for a page that draws its own header once the day loads. */
  header?: ReactNode;
}

/**
 * Loads the crew's day for every crew page and covers what comes before the page: loading,
 * an error, an account on no bus, and a day without trips.
 */
export function CrewGate({ children, header }: CrewGateProps) {
  const state = useCrewToday();
  if (state.status === AsyncStatus.Success && state.data.is_service_day) {
    return <>{children(state.data, state.refresh)}</>;
  }
  if (!header) return <GateState state={state} />;
  return (
    <div className="flex flex-col gap-6">
      {header}
      <GateState state={state} />
    </div>
  );
}

/** Everything before the page: loading, an error, an account on no bus, a day without trips. */
function GateState({ state }: { state: ReturnType<typeof useCrewToday> }) {
  const t = useTranslations("crew.gate");

  if (state.status === AsyncStatus.Loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (state.status === AsyncStatus.Error) {
    if (isApiError(state.error) && state.error.code === CrewErrorCode.NoAssignment) {
      return (
        <EmptyState icon={<BusFront />} title={t("noBusTitle")} description={t("noBusBody")} />
      );
    }
    return <ErrorState error={state.error} onRetry={state.reload} />;
  }

  const today = state.data;
  if (!today.is_service_day) {
    return (
      <EmptyState
        icon={<CalendarOff />}
        title={t("noServiceTitle")}
        description={t("noServiceBody")}
        action={
          isMockMode ? (
            <Button
              variant="secondary"
              iconStart={<FlaskConical className="size-4" />}
              onClick={() => {
                startTestDay(today.service_date);
                state.reload();
              }}
            >
              {t("testDay")}
            </Button>
          ) : undefined
        }
      />
    );
  }
  return null;
}
