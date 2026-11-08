import { setRequestLocale } from "next-intl/server";
import { SettingsPage } from "@/features/settings/components/settings-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.settings");

export default async function Page({ params }: PageProps<"/[locale]/student/settings">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <SettingsPage />;
}
