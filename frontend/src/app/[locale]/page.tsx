import { LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { BrandPattern } from "@/components/brand/brand-pattern";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { List, ListItem } from "@/components/ui/list";
import { navigationFor } from "@/features/navigation/nav-config";
import type { Locale } from "@/i18n/routing";
import { ALL_ROLES } from "@/lib/auth/roles";
import { isMockMode } from "@/lib/config";

/**
 * Start page for phase 0. Phase 1 turns "/" into the sign-in screen and sends signed-in users
 * to their role's home.
 */
export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale as Locale);
  const t = useTranslations();

  return (
    <div className="min-h-dvh bg-surface">
      <section className="relative isolate overflow-hidden bg-brand-deep text-white dark:bg-surface-alt">
        <BrandPattern />
        <div className="mx-auto flex max-w-content flex-col gap-10 px-4 pt-4 pb-14 desktop:px-8 desktop:pb-20">
          <div className="flex items-center justify-between gap-2">
            <Logo name={t("app.shortName")} tagline={t("app.tagline")} variant="white" />
            <div className="flex items-center gap-1">
              <LocaleSwitcher onBrand />
              <ThemeToggle onBrand />
            </div>
          </div>
          <div className="max-w-2xl">
            <p className="mb-3 text-label text-[#f1ae9f]">{t("app.slogan")}</p>
            <h1 className="text-display text-white">{t("home.title")}</h1>
            <p className="mt-3 text-body-lg text-white/85">{t("home.lead")}</p>
          </div>
        </div>
      </section>

      <div className="relative mx-auto -mt-8 grid max-w-content items-start gap-5 px-4 pb-12 desktop:grid-cols-2 desktop:px-8">
        <Card elevation="raised">
          <CardBody className="flex h-full flex-col gap-4">
            <h2 className="text-h2">{t("home.foundationTitle")}</h2>
            <p className="text-body text-ink">{t("home.foundationBody")}</p>
            {isMockMode ? (
              <ButtonLink
                href="/ui"
                withArrow
                iconStart={<LayoutGrid className="size-4" />}
                className="mt-auto self-start"
              >
                {t("home.openGallery")}
              </ButtonLink>
            ) : null}
          </CardBody>
        </Card>

        {isMockMode ? (
          <Card>
            <CardBody className="pb-3">
              <h2 className="text-h2">{t("home.previewTitle")}</h2>
              <p className="mt-1 text-body-sm text-ink-muted">{t("home.previewBody")}</p>
            </CardBody>
            <List className="mx-4 mb-4 sm:mx-5 sm:mb-5">
              {ALL_ROLES.map((role) => {
                const firstItem = navigationFor(role).groups[0]?.items[0];
                const Icon = firstItem?.icon;
                return (
                  <ListItem
                    key={role}
                    href={`/preview/${role}`}
                    icon={Icon ? <Icon /> : null}
                    title={t(`roles.${role}`)}
                  />
                );
              })}
            </List>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
