import { setRequestLocale } from "next-intl/server";
import { ComplaintPage } from "@/features/requests/components/complaint-page";
import type { Locale } from "@/i18n/routing";

export default async function Page({ params }: PageProps<"/[locale]/student/complaints/new">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <ComplaintPage />;
}
