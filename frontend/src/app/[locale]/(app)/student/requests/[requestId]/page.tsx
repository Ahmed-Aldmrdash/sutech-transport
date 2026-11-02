import { setRequestLocale } from "next-intl/server";
import { RequestDetailRoute } from "@/features/requests/components/request-detail-route";
import type { Locale } from "@/i18n/routing";

export default async function Page({
  params,
}: PageProps<"/[locale]/student/requests/[requestId]">) {
  const { locale, requestId } = await params;
  setRequestLocale(locale as Locale);
  return <RequestDetailRoute requestId={decodeURIComponent(requestId)} list="requests" />;
}
