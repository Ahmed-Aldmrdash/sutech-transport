"use client";

import {
  BusFront,
  CalendarX2,
  CircleCheck,
  CircleX,
  ClipboardList,
  ListChecks,
  LogOut,
  Megaphone,
  School,
  Timer,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { markNotificationRead } from "../api";
import { SessionStatus } from "@/features/auth/session/session-store";
import { useSession } from "@/features/auth/session/use-session";
import { notificationHref } from "../link";
import { NotificationKind, type AppNotification } from "../schema";
import { unreadStore } from "../unread-store";

const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  [NotificationKind.BusNear]: BusFront,
  [NotificationKind.BusDelayed]: Timer,
  [NotificationKind.PaymentApproved]: CircleCheck,
  [NotificationKind.PaymentRejected]: CircleX,
  [NotificationKind.RequestUpdate]: ClipboardList,
  [NotificationKind.Announcement]: Megaphone,
  [NotificationKind.ChildBoarded]: BusFront,
  [NotificationKind.ChildArrived]: School,
  [NotificationKind.ChildAbsent]: UserX,
  [NotificationKind.ChildNotGoing]: CalendarX2,
  [NotificationKind.ChildCheckedOut]: LogOut,
  [NotificationKind.ApprovalNeeded]: ListChecks,
};

const KIND_STYLE: Record<NotificationKind, string> = {
  [NotificationKind.BusNear]: "bg-teal-soft text-teal-text",
  [NotificationKind.BusDelayed]: "bg-warning-soft text-warning-text",
  [NotificationKind.PaymentApproved]: "bg-success-soft text-success-text",
  [NotificationKind.PaymentRejected]: "bg-danger-soft text-danger-text",
  [NotificationKind.RequestUpdate]: "bg-brand-soft text-brand",
  [NotificationKind.Announcement]: "bg-coral-soft text-coral-text",
  [NotificationKind.ChildBoarded]: "bg-teal-soft text-teal-text",
  [NotificationKind.ChildArrived]: "bg-success-soft text-success-text",
  [NotificationKind.ChildAbsent]: "bg-danger-soft text-danger-text",
  [NotificationKind.ChildNotGoing]: "bg-surface-alt text-ink",
  [NotificationKind.ChildCheckedOut]: "bg-warning-soft text-warning-text",
  [NotificationKind.ApprovalNeeded]: "bg-warning-soft text-warning-text",
};

export function NotificationRow({ item, onRead }: { item: AppNotification; onRead: () => void }) {
  const t = useTranslations("notifications");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const Icon = KIND_ICON[item.kind];
  const session = useSession();
  const role = session.status === SessionStatus.SignedIn ? session.session.user.role : null;
  const href = role ? notificationHref(item.link, role) : null;
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
