import { setRequestLocale } from "next-intl/server";
import { ParentHome } from "@/features/children/components/parent-home";
import type { Locale } from "@/i18n/routing";

export default async function Page({ params }: PageProps<"/[locale]/parent">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <ParentHome />;
}
