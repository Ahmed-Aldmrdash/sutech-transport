"use client";

import { Hammer, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { findActiveItem, navigationFor, roleHomeHref } from "@/features/navigation/nav-config";
import { usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDateTime } from "@/lib/format";
import { SessionStatus } from "../session/session-store";
import { useSession } from "../session/use-session";
import type { User } from "../schema";

/**
 * Phase 1 content for every signed-in page: the role's home shows the account, other menu
 * pages say they come in a later phase. Each phase replaces its pages with the real screens.
 */
export function SignedInPage() {
  const t = useTranslations();
  const pathname = usePathname();
  const state = useSession();
  if (state.status !== SessionStatus.SignedIn) return null;

  const { user, expires_at: expiresAt } = state.session;
  const navigation = navigationFor(user.role);
  const activeItem = findActiveItem(navigation, navigation.basePath, pathname);
  const isHome = pathname === roleHomeHref(navigation);

  if (!isHome) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow={t(`roles.${user.role}`)}
          title={activeItem ? t(`nav.items.${activeItem.key}`) : ""}
        />
        <EmptyState
          icon={<Hammer />}
          title={t("preview.pageComing")}
          description={t("preview.pageComingBody")}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={activeItem ? t(`nav.items.${activeItem.key}`) : undefined}
        title={t("session.welcome", { name: user.name.split(" ")[0] ?? user.name })}
        description={t("session.homeLead")}
      />
      <div className="grid items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <AccountCard user={user} expiresAt={expiresAt} />
        <Card>
          <CardHeader title={t("session.comingTitle")} />
          <CardBody className="flex gap-3">
            <Sparkles aria-hidden="true" className="mt-1 size-5 shrink-0 text-coral" />
            <p className="text-body text-ink">{t("session.comingBody")}</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function AccountCard({ user, expiresAt }: { user: User; expiresAt: string }) {
  const t = useTranslations("session");
  const tRoles = useTranslations("roles");
  const locale = useLocale() as Locale;
  const rows: { label: string; value: string; ltr?: boolean }[] = [
    { label: t("role"), value: tRoles(user.role) },
    { label: t("identifier"), value: user.identifier, ltr: true },
  ];
  if (user.faculty) rows.push({ label: t("faculty"), value: user.faculty });
  if (user.level) rows.push({ label: t("level"), value: t("levelValue", { level: user.level }) });
  if (user.masked_phone) rows.push({ label: t("phone"), value: user.masked_phone, ltr: true });
  rows.push({ label: t("expiresAt"), value: formatDateTime(expiresAt, locale) });

  return (
    <Card elevation="raised">
      <CardHeader title={t("accountTitle")} description={user.name} />
      <CardBody>
        <dl className="divide-y divide-line">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3">
              <dt className="text-body-sm text-ink-muted">{row.label}</dt>
              <dd className="text-body-sm font-bold text-ink-strong">
                {row.ltr ? <bdi dir="ltr">{row.value}</bdi> : row.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}
