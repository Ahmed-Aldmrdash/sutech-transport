import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RolePreview } from "@/features/navigation/components/role-preview";
import type { Locale } from "@/i18n/routing";
import { isRole } from "@/lib/auth/roles";
import { isMockMode } from "@/lib/config";

type Props = PageProps<"/[locale]/preview/[role]/[[...section]]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "preview" });
  return { title: t("title"), robots: { index: false } };
}

/** Developer preview of each role's frame and menu. Hidden when the app talks to the real server. */
export default async function RolePreviewRoute({ params }: Props) {
  if (!isMockMode) notFound();
  const { locale, role, section } = await params;
  if (!isRole(role)) notFound();
  setRequestLocale(locale as Locale);
  return <RolePreview role={role} section={section?.join("/") ?? ""} />;
}
