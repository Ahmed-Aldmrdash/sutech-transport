import { setRequestLocale } from "next-intl/server";
import { CompanyPortalPage } from "@/features/event-buses/components/company-portal-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.busCompany");

export default async function Page({ params }: PageProps<"/[locale]/admin/bus-company">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <CompanyPortalPage />;
}
