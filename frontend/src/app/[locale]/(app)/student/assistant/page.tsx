import { setRequestLocale } from "next-intl/server";
import { AssistantSoonPage } from "@/features/student-home/components/assistant-soon-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("student.assistant.title");

export default async function Page({ params }: PageProps<"/[locale]/student/assistant">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <AssistantSoonPage />;
}
