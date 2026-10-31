"use client";

import { useEffect } from "react";
import { BellOff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Async } from "@/components/ui/Async";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { useApi, useMutation } from "@/lib/api/use-api";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/time";
import { listNotifications, markAllRead } from "../api";

/** The user's notifications, newest first. Opening the screen marks them read after a moment. */
export function NotificationsScreen() {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const query = useApi(listNotifications);
  const readAll = useMutation(markAllRead);
  const unread = query.data?.unread ?? 0;
  const { run } = readAll;

  useEffect(() => {
    if (!unread) return;
    const id = setTimeout(() => void run(), 1500);
    return () => clearTimeout(id);
  }, [unread, run]);

  return (
    <>
      <PageHeader
        title={t("title")}
        actions={
          unread > 0 && (
            <Button size="sm" variant="ghost" loading={readAll.pending} onClick={() => void run()}>
              {t("markAll")}
            </Button>
          )
        }
      />
      <Async query={query}>
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState icon={<BellOff className="size-8" aria-hidden />} title={t("empty")} />
          ) : (
            <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-raised">
              {data.items.map((item) => (
                <li key={item.id} className={cn("flex gap-3 p-4", !item.read && "bg-brand-soft/50")}>
                  <span aria-hidden className={cn("mt-2 size-2 shrink-0 rounded-full", item.read ? "bg-transparent" : "bg-coral")} />
                  <div className="min-w-0">
                    <p className={cn("text-ink", !item.read && "font-bold text-ink-strong")}>
                      {!item.read && <span className="sr-only">{t("unread")} </span>}
                      {item.text}
                    </p>
                    <time dateTime={item.created_at} className="text-[13px] text-ink-muted">
                      {formatDateTime(item.created_at, locale)}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
          )
        }
      </Async>
    </>
  );
}
