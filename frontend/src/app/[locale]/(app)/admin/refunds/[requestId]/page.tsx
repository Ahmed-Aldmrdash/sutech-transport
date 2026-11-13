import { setRequestLocale } from "next-intl/server";
import { DeskRequestPage } from "@/features/request-desk/components/desk-request-page";
import { DeskSection } from "@/features/request-desk/components/desk-sections";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.refunds");

export default async function Page({ params }: PageProps<"/[locale]/admin/refunds/[requestId]">) {
  const { locale, requestId } = await params;
  setRequestLocale(locale as Locale);
  return (
    <DeskRequestPage section={DeskSection.Refunds} requestId={decodeURIComponent(requestId)} />
  );
}
