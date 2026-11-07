import { setRequestLocale } from "next-intl/server";
import { DelayPage } from "@/features/crew/components/delay-page";
import type { Locale } from "@/i18n/routing";

export default async function Page({ params }: PageProps<"/[locale]/driver/delay">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <DelayPage />;
}
