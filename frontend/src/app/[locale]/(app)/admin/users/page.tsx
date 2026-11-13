import { setRequestLocale } from "next-intl/server";
import { UsersPage } from "@/features/admin-system/components/users-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("desk.system.users.title");

export default async function Page({ params }: PageProps<"/[locale]/admin/users">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <UsersPage />;
}
