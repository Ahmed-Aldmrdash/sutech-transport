"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALES, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";

const OTHER_LOCALE: Record<Locale, Locale> = { ar: "en", en: "ar" };

/** Switches between Arabic and English on the same page, without reloading it. */
function useSwitchLocale() {
  const pathname = usePathname();
  const router = useRouter();
  const [isSwitching, startTransition] = useTransition();

  function switchTo(target: Locale) {
    const { search, hash } = window.location;
    // A client-side switch: the page stays on screen (no reload, no session check, no flash)
    // while the other language's page renders; <html lang/dir> update with it. replace, not
    // push: switching language must not add a step to the Back button.
    startTransition(() => {
      router.replace(`${pathname}${search}${hash}`, { locale: target, scroll: false });
    });
  }

  return { switchTo, isSwitching };
}

export function LocaleSwitcher({
  className,
  onBrand = false,
}: {
  className?: string;
  onBrand?: boolean;
}) {
  const t = useTranslations("common");
  const locale = useLocale();
  const { switchTo, isSwitching } = useSwitchLocale();
  const target = OTHER_LOCALE[locale];
  const switchLocale = () => switchTo(target);

  return (
    <button
      type="button"
      onClick={switchLocale}
      disabled={isSwitching}
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

const LANGUAGE_NAMES: Record<Locale, string> = { ar: "العربية", en: "English" };

/** Both languages as visible options, for the settings page. Each name is in its own language. */
export function LanguageSegmented({ label, className }: { label: string; className?: string }) {
  const locale = useLocale();
  const { switchTo, isSwitching } = useSwitchLocale();

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex rounded-md border border-line bg-surface-alt p-1", className)}
    >
      {LOCALES.map((option) => {
        const isSelected = option === locale;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            lang={option}
            aria-checked={isSelected}
            disabled={isSwitching}
            onClick={() => {
              if (!isSelected) switchTo(option);
            }}
            className={cn(
              "inline-flex h-10 items-center rounded-sm px-4 text-body-sm font-bold focus-ring transition-colors disabled:opacity-60",
              isSelected
                ? "bg-surface-raised text-brand shadow-sm"
                : "text-ink hover:text-ink-strong",
            )}
          >
            {LANGUAGE_NAMES[option]}
          </button>
        );
      })}
    </div>
  );
}
