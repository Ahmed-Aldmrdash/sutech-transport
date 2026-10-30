import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("common");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-[28px] leading-9">{t("notFoundTitle")}</h1>
      <p className="text-ink-muted">{t("notFoundBody")}</p>
      <Link href="/login" className="font-bold text-brand underline">
        {t("goHome")}
      </Link>
    </main>
  );
}
