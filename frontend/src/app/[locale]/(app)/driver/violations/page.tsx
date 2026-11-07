import { setRequestLocale } from "next-intl/server";
import { ViolationsPage } from "@/features/violations/components/violations-page";
import type { Locale } from "@/i18n/routing";

export default async function Page({ params }: PageProps<"/[locale]/driver/violations">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <ViolationsPage />;
}
