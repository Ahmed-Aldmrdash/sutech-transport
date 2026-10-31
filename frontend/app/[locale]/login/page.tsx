import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { MapPin, QrCode, Ticket } from "lucide-react";
import { Brand } from "@/components/layout/Brand";
import { LanguageToggle, ThemeToggle } from "@/components/layout/PreferenceToggles";
import { LoginForm } from "@/features/auth/components/LoginForm";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("title") };
}

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  const features = [
    { icon: Ticket, text: t("hero.f1") },
    { icon: MapPin, text: t("hero.f2") },
    { icon: QrCode, text: t("hero.f3") },
  ];
  return (
    <main className="min-h-dvh bg-surface lg:grid lg:h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Brand panel: a short band on phones, the full side of the screen on laptops. */}
      <section className="relative overflow-hidden bg-[linear-gradient(120deg,var(--color-purple-100),var(--color-brand-deep))] text-on-brand">
        <div aria-hidden className="absolute inset-0 bg-[url('/brand/pattern.svg')] opacity-90" />
        <div className="relative mx-auto flex max-w-md flex-col px-5 pt-5 pb-20 lg:h-full lg:max-w-xl lg:px-12 lg:py-10">
          <div className="flex items-center justify-between">
            <Brand inverse />
            <div className="flex items-center gap-1 lg:hidden">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
          <div className="mt-8 lg:my-auto">
            <p className="label-caps text-[12px] font-semibold text-purple-20">{t("hero.eyebrow")}</p>
            <h1 className="mt-2 text-[28px] leading-9 font-extrabold text-on-brand lg:text-[40px] lg:leading-[48px]">
              {t("hero.title")}
            </h1>
            <p className="mt-3 max-w-md text-[16px] leading-7 text-on-brand/80">{t("hero.body")}</p>
            <ul className="mt-8 hidden flex-col gap-3 lg:flex">
              {features.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-[15px] font-semibold">
                  <span className="grid size-10 place-items-center rounded-sm bg-white/15">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-10 hidden w-fit text-[13px] font-semibold tracking-[3px] text-on-brand/60 uppercase lg:block" dir="ltr">
            {t("hero.slogan")}
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="relative flex flex-col lg:overflow-y-auto">
        <div className="hidden justify-end gap-1 p-4 text-ink lg:flex">
          <LanguageToggle />
          <ThemeToggle />
        </div>
        <div className="mx-auto -mt-12 w-full max-w-md px-4 pb-10 lg:my-auto lg:mt-0 lg:px-0 lg:pb-16">
          <div className="rounded-lg bg-surface-raised p-5 shadow-card lg:p-8">
            <h2 className="text-[24px] leading-8 font-extrabold">{t("heading")}</h2>
            <p className="mt-1 mb-6 text-[15px] text-ink-muted">{t("subheading")}</p>
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </section>
    </main>
  );
}
