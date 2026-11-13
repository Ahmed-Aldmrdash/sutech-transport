import { setRequestLocale } from "next-intl/server";
import { EventDetailPage } from "@/features/event-buses/components/event-detail-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.events");

export default async function Page({ params }: PageProps<"/[locale]/admin/events/[eventId]">) {
  const { locale, eventId } = await params;
  setRequestLocale(locale as Locale);
  return <EventDetailPage eventId={decodeURIComponent(eventId)} />;
}
