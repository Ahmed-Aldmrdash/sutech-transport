import { IdCard, MapPinned, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { BrandPattern } from "@/components/brand/brand-pattern";
import { Logo } from "@/components/brand/logo";

const FEATURES = [
  { key: "featureTracking", icon: MapPinned },
  { key: "featureCard", icon: IdCard },
  { key: "featureSafety", icon: ShieldCheck },
] as const;

/** The purple side of the sign-in screen on laptops: logo, promise and three highlights. */
export function LoginBrandPanel() {
  const t = useTranslations();
  return (
    <section className="relative isolate hidden overflow-hidden bg-brand-deep text-white desktop:flex dark:bg-surface-alt">
      <BrandPattern />
      <div
        aria-hidden="true"
        className="absolute -end-24 -bottom-24 size-96 rounded-full bg-teal/30 blur-3xl"
      />
      <div className="relative flex w-full flex-col justify-between gap-12 p-12">
        <Logo name={t("app.shortName")} tagline={t("app.tagline")} variant="white" />
        <div className="max-w-md">
          <p className="mb-4 text-label text-coral-40">{t("app.slogan")}</p>
          <p className="text-display text-white">{t("login.brandTitle")}</p>
          <p className="mt-4 text-body-lg text-white/85">{t("login.brandLead")}</p>
          <ul className="mt-10 flex flex-col gap-4">
            {FEATURES.map(({ key, icon: Icon }) => (
              <li key={key} className="flex items-center gap-4 text-body text-white/90">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-md bg-white/10 ring-1 ring-white/15">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                {t(`login.${key}`)}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-caption text-white/60">{t("app.name")}</p>
      </div>
    </section>
  );
}
