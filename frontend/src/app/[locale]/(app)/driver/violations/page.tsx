import { setRequestLocale } from "next-intl/server";
import { ViolationsPage } from "@/features/violations/components/violations-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.violations");

export default async function Page({ params }: PageProps<"/[locale]/driver/violations">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <ViolationsPage />;
}
