import { setRequestLocale } from "next-intl/server";
import { SignedInPage } from "@/features/auth/components/signed-in-page";
import type { Locale } from "@/i18n/routing";

/** Parent pages from later phases (approvals): a "coming" placeholder. */
export default async function Page({ params }: PageProps<"/[locale]/parent/[...section]">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <SignedInPage />;
}
