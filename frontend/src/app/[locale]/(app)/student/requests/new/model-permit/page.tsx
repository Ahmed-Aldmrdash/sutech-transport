import { setRequestLocale } from "next-intl/server";
import { ModelPermitPage } from "@/features/requests/components/model-permit-page";
import type { Locale } from "@/i18n/routing";

export default async function Page({
  params,
}: PageProps<"/[locale]/student/requests/new/model-permit">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <ModelPermitPage />;
}
