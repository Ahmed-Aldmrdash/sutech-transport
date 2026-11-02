"use client";

import { Megaphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { listAnnouncements } from "../api";
import { ANNOUNCEMENT_KINDS, type AnnouncementKind } from "../schema";
import { AnnouncementItem } from "./announcement-item";

const PAGE_SIZE = 20;
const ALL = "all";
type KindFilter = AnnouncementKind | typeof ALL;

/** Notices from the Transportation office: official news, delays and line changes. */
export function AnnouncementsPage() {
  const t = useTranslations("announcements");
  const tKind = useTranslations("student.home.alerts.kind");
  const [kind, setKind] = useState<KindFilter>(ALL);
  const [pages, setPages] = useState(1);
  const state = useAsync(
    async (signal) => {
      const loaded = await Promise.all(
        Array.from({ length: pages }, (_, index) =>
          listAnnouncements(
            { kind: kind === ALL ? undefined : kind, page: index + 1, page_size: PAGE_SIZE },
            { signal },
          ),
        ),
      );
      return { items: loaded.flatMap((page) => page.items), total: loaded.at(-1)?.total ?? 0 };
    },
    [kind, pages],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("lead")} />
      <FilterChips
        label={t("filterLabel")}
        value={kind}
        onChange={(next) => {
          setKind(next);
          setPages(1);
        }}
        options={[
          { value: ALL, label: t("all") },
          ...ANNOUNCEMENT_KINDS.map((value) => ({ value, label: tKind(value) })),
        ]}
      />
      {state.status === AsyncStatus.Loading ? <Skeleton className="h-80 w-full" /> : null}
      {state.status === AsyncStatus.Error ? (
        <ErrorState error={state.error} onRetry={state.reload} />
      ) : null}
      {state.status === AsyncStatus.Success && state.data.items.length === 0 ? (
        <EmptyState icon={<Megaphone />} title={t("emptyTitle")} description={t("emptyBody")} />
      ) : null}
      {state.status === AsyncStatus.Success && state.data.items.length > 0 ? (
        <>
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-raised">
            {state.data.items.map((item) => (
              <li key={item.announcement_id} className="p-4 sm:p-5">
                <AnnouncementItem item={item} withTime />
              </li>
            ))}
          </ul>
          {state.data.total > state.data.items.length ? (
            <Button variant="secondary" className="self-center" onClick={() => setPages(pages + 1)}>
              {t("loadMore")}
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
