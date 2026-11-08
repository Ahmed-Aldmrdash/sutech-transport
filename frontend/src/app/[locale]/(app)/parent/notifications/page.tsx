import { setRequestLocale } from "next-intl/server";
import { NotificationsPage } from "@/features/notifications/components/notifications-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.notifications");

export default async function Page({ params }: PageProps<"/[locale]/parent/notifications">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <NotificationsPage />;
}
