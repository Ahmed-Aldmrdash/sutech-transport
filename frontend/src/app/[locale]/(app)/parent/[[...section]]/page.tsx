import { setRequestLocale } from "next-intl/server";
import { SignedInPage } from "@/features/auth/components/signed-in-page";
import type { Locale } from "@/i18n/routing";

/** Phase 1 placeholder for every page under /parent; later phases add the real screens. */
export default async function Page({ params }: PageProps<"/[locale]/parent/[[...section]]">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <SignedInPage />;
}
