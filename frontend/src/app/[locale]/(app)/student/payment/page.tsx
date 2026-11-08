import { setRequestLocale } from "next-intl/server";
import { PaymentPage } from "@/features/payments/components/payment-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.payment");

export default async function Page({ params }: PageProps<"/[locale]/student/payment">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <PaymentPage />;
}
