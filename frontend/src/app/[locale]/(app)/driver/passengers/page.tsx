import { setRequestLocale } from "next-intl/server";
import { PassengersPage } from "@/features/crew/components/passengers-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.passengers");

export default async function Page({ params }: PageProps<"/[locale]/driver/passengers">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <PassengersPage />;
}
