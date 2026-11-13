import { setRequestLocale } from "next-intl/server";
import { EventsPage } from "@/features/event-buses/components/events-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.events");

export default async function Page({ params }: PageProps<"/[locale]/admin/events">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <EventsPage />;
}
