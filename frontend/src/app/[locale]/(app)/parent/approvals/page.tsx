import { setRequestLocale } from "next-intl/server";
import { GuardianApprovalsPage } from "@/features/requests/components/guardian-approvals-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.approvals");

export default async function Page({ params }: PageProps<"/[locale]/parent/approvals">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <GuardianApprovalsPage />;
}
