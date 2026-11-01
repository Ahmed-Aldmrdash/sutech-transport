import { SearchX } from "lucide-react";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  const t = useTranslations();
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl items-center px-4 py-10">
      <EmptyState
        className="w-full"
        icon={<SearchX />}
        title={t("errors.pageNotFound.title")}
        description={t("errors.pageNotFound.description")}
        action={<ButtonLink href="/">{t("common.backHome")}</ButtonLink>}
      />
    </main>
  );
}
