"use client";

import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { useUnreadCount } from "../unread-store";
import { CountBadge } from "./count-badge";

/** The bell in the laptop top bar, with the unread count. Phones use the bottom bar's badge. */
export function NotificationBell({ href, className }: { href: string; className?: string }) {
  const t = useTranslations("notifications");
  const unread = useUnreadCount();
  return (
    <Link
      href={href}
      className={cn(
        "relative inline-flex size-10 items-center justify-center rounded-md text-ink-strong focus-ring transition-colors hover:bg-brand-soft",
        className,
      )}
    >
      <Bell aria-hidden="true" className="size-5" />
      {/* Hidden text, not aria-label: the visible "9+" stays out of the spoken name. */}
      <span className="sr-only">{unread > 0 ? t("bellUnread", { count: unread }) : t("bell")}</span>
      {unread > 0 ? <CountBadge count={unread} className="absolute -end-0.5 -top-0.5" /> : null}
    </Link>
  );
}
