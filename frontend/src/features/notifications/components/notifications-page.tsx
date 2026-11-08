"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tone } from "@/components/ui/tone";
import { useToast } from "@/components/ui/toast";
import { Role } from "@/lib/auth/roles";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { listNotifications, markAllNotificationsRead } from "../api";
import { SessionStatus } from "@/features/auth/session/session-store";
import { useSession } from "@/features/auth/session/use-session";
import { unreadStore } from "../unread-store";
import { NotificationRow } from "./notification-row";

const PAGE_SIZE = 20;

const Filter = { All: "all", Unread: "unread" } as const;
type Filter = (typeof Filter)[keyof typeof Filter];

/**
 * Everything the app told the user. Students: bus near, payments, requests, notices. Guardians:
 * their children boarding, arriving, absent, not going or leaving the bus.
 */
export function NotificationsPage() {
  const t = useTranslations("notifications");
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>(Filter.All);
  const [pages, setPages] = useState(1);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const session = useSession();
  const isParent =
    session.status === SessionStatus.SignedIn && session.session.user.role === Role.Parent;
  // Every page shown so far, re-read together so a refresh keeps the list in step.
  const state = useAsync(
    async (signal) => {
      const unreadOnly = filter === Filter.Unread;
      const loaded = await Promise.all(
        Array.from({ length: pages }, (_, index) =>
          listNotifications(
            { page: index + 1, page_size: PAGE_SIZE, unread_only: unreadOnly },
            { signal },
          ),
        ),
      );
      const last = loaded.at(-1);
      return {
        items: loaded.flatMap((page) => page.items),
        total: last?.total ?? 0,
        unread_count: last?.unread_count ?? 0,
      };
    },
    [filter, pages],
  );
  const unread = state.status === AsyncStatus.Success ? state.data.unread_count : null;

  useEffect(() => {
    if (unread !== null) unreadStore.set(unread);
  }, [unread]);

  async function markAll() {
    setIsMarkingAll(true);
    try {
      const result = await markAllNotificationsRead();
      unreadStore.set(result.unread_count);
      state.refresh();
    } catch {
      toast.show({ title: t("markAllFailed"), tone: Tone.Danger });
    } finally {
      setIsMarkingAll(false);
    }
  }

  const header = (
    <PageHeader
      title={t("title")}
      description={isParent ? t("leadParent") : t("lead")}
      actions={
        <Button
          variant="secondary"
          size="sm"
          iconStart={<CheckCheck className="size-4" />}
          disabled={!unread}
          isLoading={isMarkingAll}
          onClick={() => void markAll()}
        >
          {t("markAll")}
        </Button>
      }
    />
  );

  return (
    <div className="flex flex-col gap-6">
      {header}
      <FilterChips
        label={t("filterLabel")}
        value={filter}
        onChange={(next) => {
          setFilter(next);
          setPages(1);
        }}
        options={[
          { value: Filter.All, label: t("filter.all") },
          {
            value: Filter.Unread,
            label: unread ? t("filter.unreadCount", { count: unread }) : t("filter.unread"),
          },
        ]}
      />

      {state.status === AsyncStatus.Loading ? <Skeleton className="h-80 w-full" /> : null}
      {state.status === AsyncStatus.Error ? (
        <ErrorState error={state.error} onRetry={state.reload} />
      ) : null}
      {state.status === AsyncStatus.Success && state.data.items.length === 0 ? (
        <EmptyState
          icon={<Bell />}
          title={filter === Filter.Unread ? t("emptyUnreadTitle") : t("emptyTitle")}
          description={t("emptyBody")}
        />
      ) : null}
      {state.status === AsyncStatus.Success && state.data.items.length > 0 ? (
        <>
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-raised">
            {state.data.items.map((item) => (
              <NotificationRow key={item.notification_id} item={item} onRead={state.refresh} />
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
