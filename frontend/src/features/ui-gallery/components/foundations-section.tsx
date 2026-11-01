import { useTranslations } from "next-intl";
import { GallerySection } from "./gallery-section";

const COLOR_TOKENS = [
  "brand",
  "brand-deep",
  "brand-soft",
  "teal",
  "teal-soft",
  "coral",
  "coral-soft",
  "danger",
  "danger-soft",
  "success",
  "success-soft",
  "warning",
  "warning-soft",
  "ink-strong",
  "ink",
  "ink-muted",
  "line",
  "surface",
  "surface-alt",
  "surface-raised",
] as const;

const TYPE_STYLES = [
  "text-display",
  "text-h1",
  "text-h2",
  "text-h3",
  "text-body-lg",
  "text-body",
  "text-body-sm",
  "text-label",
  "text-caption",
] as const;

export function FoundationsSection() {
  const t = useTranslations("gallery");
  return (
    <>
      <GallerySection id="colors" title={t("sections.colors")} description={t("colorsNote")}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 desktop:grid-cols-5">
          {COLOR_TOKENS.map((token) => (
            <li
              key={token}
              className="overflow-hidden rounded-md border border-line bg-surface-raised"
            >
              <span
                className="block h-14 border-b border-line"
                style={{ background: `var(--sut-${token})` }}
              />
              <code dir="ltr" className="block px-2 py-1.5 font-mono text-caption text-ink">
                {token}
              </code>
            </li>
          ))}
        </ul>
      </GallerySection>

      <GallerySection id="type" title={t("sections.type")}>
        <div className="flex flex-col gap-4 rounded-card border border-line bg-surface-raised p-4 sm:p-5">
          {TYPE_STYLES.map((style) => (
            <div
              key={style}
              className="flex flex-col gap-1 border-b border-line pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-6"
            >
              <code dir="ltr" className="w-32 shrink-0 font-mono text-caption text-ink-muted">
                {style}
              </code>
              <p className={`${style} min-w-0 text-ink-strong`}>{t("typeSample")}</p>
            </div>
          ))}
        </div>
      </GallerySection>
    </>
  );
}
