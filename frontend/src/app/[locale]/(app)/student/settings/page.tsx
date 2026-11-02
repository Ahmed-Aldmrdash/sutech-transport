import { setRequestLocale } from "next-intl/server";
import { SettingsPage } from "@/features/settings/components/settings-page";
import type { Locale } from "@/i18n/routing";

export default async function Page({ params }: PageProps<"/[locale]/student/settings">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <SettingsPage />;
}
