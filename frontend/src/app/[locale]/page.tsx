import { setRequestLocale } from "next-intl/server";
import { StartRedirect } from "@/features/auth/components/start-redirect";
import type { Locale } from "@/i18n/routing";

/** "/ar" and "/en": signed-in users go to their role's home, everyone else to sign-in. */
export default async function StartPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <StartRedirect />;
}
