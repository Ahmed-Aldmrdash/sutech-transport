import { setRequestLocale } from "next-intl/server";
import { ComplaintsPage } from "@/features/requests/components/requests-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.complaints");

export default async function Page({ params }: PageProps<"/[locale]/student/complaints">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <ComplaintsPage />;
}
