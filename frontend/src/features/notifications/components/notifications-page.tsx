"use client";

import {
  Bell,
  BusFront,
  CheckCheck,
  CircleCheck,
  CircleX,
  ClipboardList,
  Megaphone,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tone } from "@/components/ui/tone";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "../api";
import { notificationHref } from "../link";
import { NotificationKind, type AppNotification } from "../schema";
import { unreadStore } from "../unread-store";

const PAGE_SIZE = 20;

const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  [NotificationKind.BusNear]: BusFront,
  [NotificationKind.BusDelayed]: Timer,
  [NotificationKind.PaymentApproved]: CircleCheck,
  [NotificationKind.PaymentRejected]: CircleX,
  [NotificationKind.RequestUpdate]: ClipboardList,
  [NotificationKind.Announcement]: Megaphone,
};

const KIND_STYLE: Record<NotificationKind, string> = {
  [NotificationKind.BusNear]: "bg-teal-soft text-teal-text",
  [NotificationKind.BusDelayed]: "bg-warning-soft text-warning-text",
  [NotificationKind.PaymentApproved]: "bg-success-soft text-success-text",
  [NotificationKind.PaymentRejected]: "bg-danger-soft text-danger",
  [NotificationKind.RequestUpdate]: "bg-brand-soft text-brand",
  [NotificationKind.Announcement]: "bg-coral-soft text-coral-text",
};

const Filter = { All: "all", Unread: "unread" } as const;
type Filter = (typeof Filter)[keyof typeof Filter];

/** Everything the app told the student: bus near, payment results, request answers, notices. */
export function NotificationsPage() {
  const t = useTranslations("notifications");
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>(Filter.All);
  const [pages, setPages] = useState(1);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
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
      description={t("lead")}
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

function NotificationRow({ item, onRead }: { item: AppNotification; onRead: () => void }) {
  const t = useTranslations("notifications");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const Icon = KIND_ICON[item.kind];
  const href = notificationHref(item.link);
  const isUnread = item.read_at === null;

  function open() {
    if (isUnread) {
      markNotificationRead(item.notification_id).then(
        (result) => {
          unreadStore.set(result.unread_count);
          onRead();
        },
        () => undefined, // Stays unread; nothing else depends on it.
      );
    }
    if (href) router.push(href);
  }

  const content = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex size-10 shrink-0 items-center justify-center rounded-sm [&_svg]:size-5",
          KIND_STYLE[item.kind],
        )}
      >
        <Icon />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 text-body text-ink-strong",
              isUnread ? "font-bold" : "font-normal",
            )}
          >
            {item.title}
          </span>
          {isUnread ? (
            <span className="mt-2 size-2.5 shrink-0 rounded-full bg-brand">
              <span className="sr-only">{t("unread")}</span>
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-body-sm text-ink">{item.body}</span>
        <time dateTime={item.created_at} className="mt-1 block text-caption text-ink-muted">
          {formatDateTime(item.created_at, locale)}
        </time>
      </span>
    </>
  );

  const rowStyles = cn(
    "flex w-full items-start gap-3 px-4 py-3 text-start",
    isUnread && "bg-brand-soft/40",
  );
  return (
    <li>
      {href || isUnread ? (
        <button
          type="button"
          onClick={open}
          className={cn(rowStyles, "focus-ring transition-colors hover:bg-surface-alt")}
        >
          {content}
        </button>
      ) : (
        <div className={rowStyles}>{content}</div>
      )}
    </li>
  );
}
