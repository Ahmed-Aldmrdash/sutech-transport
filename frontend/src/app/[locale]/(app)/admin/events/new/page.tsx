import { setRequestLocale } from "next-intl/server";
import { NewEventPage } from "@/features/event-buses/components/new-event-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("desk.events.form.title");

export default async function Page({ params }: PageProps<"/[locale]/admin/events/new">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <NewEventPage />;
}
