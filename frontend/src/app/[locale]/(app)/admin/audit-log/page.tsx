import { setRequestLocale } from "next-intl/server";
import { AuditLogPage } from "@/features/admin-system/components/audit-log-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("desk.system.audit.title");

export default async function Page({ params }: PageProps<"/[locale]/admin/audit-log">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <AuditLogPage />;
}
