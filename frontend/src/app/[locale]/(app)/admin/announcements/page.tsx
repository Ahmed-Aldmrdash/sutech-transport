import { setRequestLocale } from "next-intl/server";
import { OfficeAnnouncementsPage } from "@/features/announcements/components/office-announcements-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.announcements");

export default async function Page({ params }: PageProps<"/[locale]/admin/announcements">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <OfficeAnnouncementsPage />;
}
