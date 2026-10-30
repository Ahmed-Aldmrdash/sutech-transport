"use client";

import { Megaphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Async } from "@/components/ui/Async";
import { EmptyState } from "@/components/ui/States";
import { useApi } from "@/lib/api/use-api";
import { listAnnouncements } from "../api";
import { AnnouncementCard } from "./AnnouncementCard";

/** Announcements for the signed-in user (the server filters by their line), pinned first. */
export function AnnouncementFeed({ pinnedOnly = false, limit }: { pinnedOnly?: boolean; limit?: number }) {
  const t = useTranslations("announcements");
  const query = useApi(listAnnouncements);
  return (
    <Async query={query}>
      {(data) => {
        const sorted = [...data.items].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.published_at.localeCompare(a.published_at));
        const items = (pinnedOnly ? sorted.filter((item) => item.pinned) : sorted).slice(0, limit);
        if (!items.length) {
          return pinnedOnly ? null : <EmptyState icon={<Megaphone className="size-8" aria-hidden />} title={t("empty")} />;
        }
        return (
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <AnnouncementCard key={item.id} item={item} />
            ))}
          </div>
        );
      }}
    </Async>
  );
}
