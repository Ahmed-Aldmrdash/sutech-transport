import { setRequestLocale } from "next-intl/server";
import { CompanyRequestPage } from "@/features/event-buses/components/company-request-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.busCompany");

export default async function Page({ params }: PageProps<"/[locale]/admin/bus-company/[eventId]">) {
  const { locale, eventId } = await params;
  setRequestLocale(locale as Locale);
  return <CompanyRequestPage eventId={decodeURIComponent(eventId)} />;
}
