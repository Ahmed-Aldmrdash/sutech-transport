import { setRequestLocale } from "next-intl/server";
import { PlannedOfficePage } from "@/features/navigation/components/planned-office-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("session.plannedTitle");

/**
 * An office page from the plan that isn't built yet (e.g. /admin/payments): "coming soon"
 * inside the app, with the menu and sign-out, instead of a bare "page not found". Only the
 * offices that own the page get here; anyone else is sent to their own home.
 */
export default async function Page({ params }: PageProps<"/[locale]/admin/[...planned]">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <PlannedOfficePage />;
}
