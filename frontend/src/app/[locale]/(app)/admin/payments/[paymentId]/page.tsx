import { setRequestLocale } from "next-intl/server";
import { PaymentReviewPage } from "@/features/finance-desk/components/payment-review-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.payments");

export default async function Page({ params }: PageProps<"/[locale]/admin/payments/[paymentId]">) {
  const { locale, paymentId } = await params;
  setRequestLocale(locale as Locale);
  return <PaymentReviewPage paymentId={decodeURIComponent(paymentId)} />;
}
