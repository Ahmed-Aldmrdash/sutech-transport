import { setRequestLocale } from "next-intl/server";
import { TripPage } from "@/features/crew/components/trip-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.trip");

export default async function Page({ params }: PageProps<"/[locale]/driver">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <TripPage />;
}
