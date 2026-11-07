import { setRequestLocale } from "next-intl/server";
import { ScanPage } from "@/features/crew/components/scan-page";
import type { Locale } from "@/i18n/routing";

export default async function Page({ params }: PageProps<"/[locale]/driver/scan">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <ScanPage />;
}
