import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
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
  return (
    <main className="min-h-dvh bg-surface">
      <div className="bg-brand-deep px-4 pt-4 pb-16 text-on-brand dark:bg-surface-alt">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Brand inverse />
          <div className="flex items-center gap-1 text-on-brand dark:text-ink">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-md">
          <h1 className="text-[28px] leading-10 font-extrabold text-on-brand dark:text-ink-strong">{t("heading")}</h1>
          <p className="mt-1 text-[16px] opacity-90">{t("subheading")}</p>
        </div>
      </div>
      <div className="mx-auto -mt-10 max-w-md px-4 pb-10">
        <div className="rounded-lg bg-surface-raised p-5 shadow-card">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
