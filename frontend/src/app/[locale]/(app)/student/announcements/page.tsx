import { setRequestLocale } from "next-intl/server";
import { AnnouncementsPage } from "@/features/announcements/components/announcements-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.announcements");

export default async function Page({ params }: PageProps<"/[locale]/student/announcements">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <AnnouncementsPage />;
}
