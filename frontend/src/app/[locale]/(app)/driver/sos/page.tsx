import { setRequestLocale } from "next-intl/server";
import { SosPage } from "@/features/sos/components/sos-page";
import type { Locale } from "@/i18n/routing";

export default async function Page({ params }: PageProps<"/[locale]/driver/sos">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <SosPage />;
}
