import { setRequestLocale } from "next-intl/server";
import { PaymentsDeskPage } from "@/features/finance-desk/components/payments-desk-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.payments");

export default async function Page({ params }: PageProps<"/[locale]/admin/payments">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <PaymentsDeskPage />;
}
