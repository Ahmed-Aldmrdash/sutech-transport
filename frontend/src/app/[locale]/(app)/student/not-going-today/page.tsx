import { setRequestLocale } from "next-intl/server";
import { NotGoingPage } from "@/features/absences/components/not-going-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.notGoingToday");

export default async function Page({ params }: PageProps<"/[locale]/student/not-going-today">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <NotGoingPage />;
}
