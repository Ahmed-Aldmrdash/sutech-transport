import { setRequestLocale } from "next-intl/server";
import { NotificationsPage } from "@/features/notifications/components/notifications-page";
import type { Locale } from "@/i18n/routing";

export default async function Page({ params }: PageProps<"/[locale]/student/notifications">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <NotificationsPage />;
}
