"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Async } from "@/components/ui/Async";
import { EmptyState } from "@/components/ui/States";
import { isActive } from "@/features/subscriptions/schema";
import { getChildTracking } from "@/features/tracking/api";
import { TrackingView } from "@/features/tracking/components/TrackingView";
import { useApi, usePolling } from "@/lib/api/use-api";
import type { Child } from "../schema";
import { useChildren } from "./ChildProvider";
import { ChildSwitcher } from "./ChildSwitcher";

const ETA_REFRESH_MS = 20_000;

export function ParentTracking() {
  const t = useTranslations("parent");
  const { query, selected } = useChildren();
  return (
    <>
      <PageHeader title={t("trackingTitle")} />
      <Async query={query}>
        {() =>
          selected ? (
            <>
              <ChildSwitcher />
              {isActive(selected.subscription) ? <ChildTracking child={selected} /> : <EmptyState title={t("notSubscribed")} />}
            </>
          ) : (
            <EmptyState title={t("noChildren")} />
          )
        }
      </Async>
    </>
  );
}

function ChildTracking({ child }: { child: Child }) {
  const query = useApi(() => getChildTracking(child.student_id), [child.student_id]);
  usePolling(query.reload, ETA_REFRESH_MS);
  return <Async query={query}>{(data) => <TrackingView data={data} />}</Async>;
}
