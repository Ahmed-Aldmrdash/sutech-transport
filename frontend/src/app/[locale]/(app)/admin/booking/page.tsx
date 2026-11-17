import { setRequestLocale } from "next-intl/server";
import { BookingWindowPage } from "@/features/booking-window/components/booking-window-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.bookingWindow");

export default async function Page({ params }: PageProps<"/[locale]/admin/booking">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <BookingWindowPage />;
}
