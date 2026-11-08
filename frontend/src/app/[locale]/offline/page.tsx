import { WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { SavedCardView } from "@/features/card/components/saved-card-view";
import { pageTitle } from "@/i18n/page-title";
import type { Locale } from "@/i18n/routing";

export const generateMetadata = pageTitle("errors.offline.title");

/** Shown by the service worker when a page that isn't cached is opened without internet. */
export default function OfflinePage({ params }: PageProps<"/[locale]/offline">) {
  const { locale } = use(params);
  setRequestLocale(locale as Locale);
  const t = useTranslations("errors.offline");
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-5 px-4 py-10">
      <EmptyState
        className="w-full"
        headingLevel={1}
        icon={<WifiOff />}
        title={t("title")}
        description={t("description")}
      />
      {/* A student's saved card, if this phone opened it before (filled in on the phone). */}
      <SavedCardView />
    </main>
  );
}
