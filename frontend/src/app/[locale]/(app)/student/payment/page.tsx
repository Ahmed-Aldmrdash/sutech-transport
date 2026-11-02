import { setRequestLocale } from "next-intl/server";
import { PaymentPage } from "@/features/payments/components/payment-page";
import type { Locale } from "@/i18n/routing";

export default async function Page({ params }: PageProps<"/[locale]/student/payment">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <PaymentPage />;
}
