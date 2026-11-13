import { setRequestLocale } from "next-intl/server";
import { RequestDeskPage } from "@/features/request-desk/components/request-desk-page";
import { DeskSection } from "@/features/request-desk/components/desk-sections";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.complaints");

export default async function Page({ params }: PageProps<"/[locale]/admin/complaints">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <RequestDeskPage section={DeskSection.Complaints} />;
}
