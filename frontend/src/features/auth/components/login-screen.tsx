"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { BrandPattern } from "@/components/brand/brand-pattern";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Alert } from "@/components/ui/alert";
import { useRouter } from "@/i18n/navigation";
import { SignInReason, landingPathFor } from "../access";
import { SessionStatus } from "../session/session-store";
import { useSession } from "../session/use-session";
import { FullPageLoader } from "./full-page-loader";
import { LoginBrandPanel } from "./login-brand-panel";
import { LoginForm } from "./login-form";
import type { SavedCodeStep } from "./login-step-storage";

interface LoginScreenProps {
  next: string | null;
  reason: SignInReason | null;
  savedCodeStep: SavedCodeStep | null;
}

/**
 * Sign-in for every role. Laptop: purple brand half + form half. Phone: a short purple header
 * with the form on a card that overlaps it. Someone already signed in goes straight home.
 */
export function LoginScreen({ next, reason, savedCodeStep }: LoginScreenProps) {
  const t = useTranslations();
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (session.status === SessionStatus.SignedIn) {
      router.replace(landingPathFor(session.session.user.role, next));
    }
  }, [session, next, router]);

  // Signed in (e.g. Back from the home page): never show the form, just go home.
  if (session.status === SessionStatus.SignedIn) {
    return <FullPageLoader label={t("session.checking")} />;
  }

  return (
    <div className="grid min-h-dvh grid-cols-1 bg-surface desktop:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <LoginBrandPanel />

      <div className="flex min-w-0 flex-col">
        <header className="relative isolate overflow-hidden bg-brand-deep pb-16 desktop:bg-transparent desktop:pb-0 dark:bg-surface-alt desktop:dark:bg-transparent">
          <BrandPattern className="desktop:hidden" />
          <div className="relative flex items-center justify-between gap-2 px-4 pt-3 desktop:justify-end desktop:px-8 desktop:pt-6">
            <span className="desktop:hidden">
              <Logo name={t("app.shortName")} tagline={t("app.tagline")} variant="white" />
            </span>
            <div className="flex items-center gap-1">
              <span className="desktop:hidden">
                <LocaleSwitcher onBrand className="max-sm:px-2" />
              </span>
              <span className="desktop:hidden">
                <ThemeToggle onBrand />
              </span>
              <span className="hidden items-center gap-1 desktop:flex">
                <LocaleSwitcher />
                <ThemeToggle />
              </span>
            </div>
          </div>
          <p className="relative px-4 pt-6 text-h2 text-white desktop:hidden">
            {t("login.welcome")}
          </p>
        </header>

        <main className="flex flex-1 items-start justify-center px-4 pb-10 desktop:items-center desktop:px-8 desktop:py-12">
          <div className="relative -mt-10 w-full max-w-md rounded-card border border-line bg-surface-raised p-5 shadow-card sm:p-8 desktop:mt-0 desktop:border-0 desktop:bg-transparent desktop:p-0 desktop:shadow-none">
            {reason ? (
              <Alert
                className="mb-6"
                tone={reason === SignInReason.Expired ? "warning" : "success"}
                title={
                  reason === SignInReason.Expired
                    ? t("login.notices.expired")
                    : t("login.notices.signedOut")
                }
              />
            ) : null}
            <LoginForm next={next} savedCodeStep={savedCodeStep} />
            <p className="mt-8 text-center text-body-sm text-ink-muted">{t("login.help")}</p>
          </div>
        </main>
      </div>
    </div>
  );
}
