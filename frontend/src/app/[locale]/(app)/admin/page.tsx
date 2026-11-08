import { setRequestLocale } from "next-intl/server";
import { OfficeWelcomePage } from "@/features/auth/components/office-welcome-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.home");

/**
 * Home for an office with no built page yet. Offices with one (transport, clinic, the super
 * admin) are sent to it, since this path isn't in their menu.
 */
export default async function Page({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <OfficeWelcomePage />;
}
