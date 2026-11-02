import { setRequestLocale } from "next-intl/server";
import { RefundPage } from "@/features/requests/components/refund-page";
import type { Locale } from "@/i18n/routing";

export default async function Page({ params }: PageProps<"/[locale]/student/requests/new/refund">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <RefundPage />;
}
