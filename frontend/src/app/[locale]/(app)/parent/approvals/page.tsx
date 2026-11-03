import { setRequestLocale } from "next-intl/server";
import { GuardianApprovalsPage } from "@/features/requests/components/guardian-approvals-page";
import type { Locale } from "@/i18n/routing";

export default async function Page({ params }: PageProps<"/[locale]/parent/approvals">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <GuardianApprovalsPage />;
}
