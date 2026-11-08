import { setRequestLocale } from "next-intl/server";
import { RefundPage } from "@/features/requests/components/refund-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("student.requests.refund.title");

export default async function Page({ params }: PageProps<"/[locale]/student/requests/new/refund">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <RefundPage />;
}
