import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeSegmented } from "@/components/layout/theme-toggle";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ApiSection } from "./api-section";
import { ControlsSection } from "./controls-section";
import { DisplaySection } from "./display-section";
import { FoundationsSection } from "./foundations-section";
import { OverlaysSection } from "./overlays-section";
import { StatesSection } from "./states-section";
import { TableSection } from "./table-section";

const SECTION_IDS = [
  "colors",
  "type",
  "buttons",
  "forms",
  "cards",
  "status",
  "lists",
  "tables",
  "overlays",
  "states",
  "api",
] as const;

export function GalleryPage() {
  const t = useTranslations();
  return (
    <div className="min-h-dvh bg-surface">
      <header className="sticky top-0 z-nav border-b border-line bg-glass backdrop-blur-md">
        <div className="mx-auto flex h-app-bar max-w-content items-center gap-2 px-4 desktop:px-8">
          <Logo name={t("app.shortName")} tagline={t("app.tagline")} />
          <div className="ms-auto flex items-center gap-1">
            <LocaleSwitcher className="max-sm:px-2 max-sm:[&>span]:sr-only" />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto flex max-w-content flex-col gap-10 px-4 py-8 desktop:px-8">
        <div className="flex flex-col gap-4">
          <ButtonLink
            href="/"
            variant="ghost"
            size="sm"
            className="-ms-3 self-start"
            iconStart={<ArrowLeft className="size-4 rtl:-scale-x-100" />}
          >
            {t("common.backHome")}
          </ButtonLink>
          <PageHeader
            eyebrow={t("gallery.devOnly")}
            title={t("gallery.title")}
            description={t("gallery.description")}
          />
          <ThemeSegmented className="self-start" />
          <nav aria-label={t("gallery.title")} className="-mx-4 overflow-x-auto px-4">
            <ul className="flex gap-2 pb-1">
              {SECTION_IDS.map((id) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="inline-flex h-9 items-center rounded-pill border border-line bg-surface-raised px-3 text-body-sm font-bold whitespace-nowrap text-ink focus-ring hover:border-brand hover:text-brand"
                  >
                    {t(`gallery.sections.${id}`)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <FoundationsSection />
        <ControlsSection />
        <DisplaySection />
        <TableSection />
        <OverlaysSection />
        <StatesSection />
        <ApiSection />
      </main>
    </div>
  );
}
