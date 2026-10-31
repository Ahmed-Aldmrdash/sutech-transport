"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { AnnouncementFeed } from "./AnnouncementFeed";

export function AnnouncementsScreen() {
  const t = useTranslations("announcements");
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <AnnouncementFeed />
    </>
  );
}
