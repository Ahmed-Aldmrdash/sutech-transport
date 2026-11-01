import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SignInReason, safeNextPath } from "@/features/auth/access";
import { LoginScreen } from "@/features/auth/components/login-screen";
import {
  LOGIN_STEP_COOKIE,
  parseSavedCodeStep,
} from "@/features/auth/components/login-step-storage";
import type { Locale } from "@/i18n/routing";

type Props = PageProps<"/[locale]/login">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "login" });
  return { title: t("metaTitle") };
}

const REASONS: readonly string[] = Object.values(SignInReason);

function single(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const query = await searchParams;
  const reason = single(query.reason);
  const savedCodeStep = parseSavedCodeStep((await cookies()).get(LOGIN_STEP_COOKIE)?.value);
  return (
    <LoginScreen
      next={safeNextPath(single(query.next))}
      reason={reason && REASONS.includes(reason) ? (reason as SignInReason) : null}
      savedCodeStep={savedCodeStep}
    />
  );
}
