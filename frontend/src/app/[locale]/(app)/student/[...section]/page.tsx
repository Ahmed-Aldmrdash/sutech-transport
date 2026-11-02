import { setRequestLocale } from "next-intl/server";
import { SignedInPage } from "@/features/auth/components/signed-in-page";
import type { Locale } from "@/i18n/routing";

/** Student pages from later phases (tracking, notifications, …): a "coming" placeholder. */
export default async function Page({ params }: PageProps<"/[locale]/student/[...section]">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <SignedInPage />;
}
