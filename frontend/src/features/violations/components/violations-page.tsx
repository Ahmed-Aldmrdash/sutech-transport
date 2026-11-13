"use client";

import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { CrewGate } from "@/features/crew/components/crew-gate";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { listMyViolations } from "../api";
import { ViolationForm } from "./violation-form";
import { MyList } from "./violations-list";

/** A breach of the bus Code of Conduct, with a photo, for Student Affairs and Transport. */
export function ViolationsPage() {
  const t = useTranslations("violations");
  const mine = useAsync((signal) => listMyViolations({ signal }), []);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("lead")} />
      <CrewGate>
        {(today) => (
          <div className="grid grid-cols-1 items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <ViolationForm today={today} onSent={mine.refresh} />
            <Card>
              <CardHeader title={t("mineTitle")} headingLevel={2} />
              <CardBody>
                {mine.status === AsyncStatus.Loading ? <Skeleton className="h-32 w-full" /> : null}
                {mine.status === AsyncStatus.Error ? (
                  <ErrorState error={mine.error} onRetry={mine.reload} />
                ) : null}
                {mine.status === AsyncStatus.Success ? <MyList items={mine.data.items} /> : null}
              </CardBody>
            </Card>
          </div>
        )}
      </CrewGate>
    </div>
  );
}
