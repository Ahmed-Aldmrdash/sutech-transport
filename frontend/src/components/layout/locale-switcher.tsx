"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";

const OTHER_LOCALE: Record<Locale, Locale> = { ar: "en", en: "ar" };

/** Switches between Arabic and English on the same page. */
export function LocaleSwitcher({
  className,
  onBrand = false,
}: {
  className?: string;
  onBrand?: boolean;
}) {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const target = OTHER_LOCALE[locale];

  function switchLocale() {
    // Read at click time (not useSearchParams) so pages stay statically renderable.
    const query = window.location.search.slice(1);
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { locale: target, scroll: false });
    });
  }

  return (
    <button
      type="button"
      onClick={switchLocale}
      disabled={isPending}
      lang={target}
      aria-label={t("switchLanguage")}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-md px-3 text-body-sm font-bold focus-ring transition-colors disabled:opacity-60",
        onBrand ? "text-white hover:bg-white/15" : "text-ink-strong hover:bg-brand-soft",
        className,
      )}
    >
      <Languages aria-hidden="true" className="size-5" />
      <span>{t("otherLanguageName")}</span>
    </button>
  );
}
