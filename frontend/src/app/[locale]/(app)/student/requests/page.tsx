import { setRequestLocale } from "next-intl/server";
import { RequestsPage } from "@/features/requests/components/requests-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.requests");

export default async function Page({ params }: PageProps<"/[locale]/student/requests">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <RequestsPage />;
}
