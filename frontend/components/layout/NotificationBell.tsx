"use client";

import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { listNotifications } from "@/features/notifications/api";
import { Link } from "@/i18n/navigation";
import { useApi } from "@/lib/api/use-api";
import { useLive } from "@/lib/realtime";
import { cn } from "@/lib/cn";

export function NotificationBell({ href, className }: { href: string; className?: string }) {
  const t = useTranslations("common");
  const query = useApi(listNotifications);
  useLive("notification.new", () => undefined);
  const unread = query.data?.unread ?? 0;
  return (
    <Link
      href={href}
      aria-label={unread ? `${t("notifications")} (${unread})` : t("notifications")}
      className={cn("relative inline-flex size-10 items-center justify-center rounded-md hover:bg-brand-soft", className)}
    >
      <Bell className="size-5" aria-hidden />
      {unread > 0 && (
        <span className="num absolute -top-0.5 -end-0.5 grid min-w-5 place-items-center rounded-full bg-coral px-1 text-[11px] leading-5 font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
