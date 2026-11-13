"use client";

import { Clock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { navigationFor, soonItems } from "@/features/navigation/nav-config";
import type { Locale } from "@/i18n/routing";
import { formatDateTime } from "@/lib/format";
import { SessionStatus } from "../session/session-store";
import { useSession } from "../session/use-session";
import type { User } from "../schema";
import { greetingNameOf, userText } from "../user-text";

/**
 * Home of an office whose pages aren't built yet (finance, student affairs, the Secretary
 * General, Abu El Hol): who is signed in, and the pages that will open here, marked as coming
 * soon. An office with a built page lands on that page instead and never sees this one.
 */
export function OfficeWelcomePage() {
  const locale = useLocale() as Locale;
  const t = useTranslations();
  const state = useSession();
  if (state.status !== SessionStatus.SignedIn) return null;

  const { user, expires_at: expiresAt } = state.session;
  const upcoming = soonItems(navigationFor(user.role));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t(`roles.${user.role}`)}
        title={t("session.welcome", { name: greetingNameOf(user, locale) })}
        description={t("session.homeLead")}
      />
      <div className="grid grid-cols-1 items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <AccountCard user={user} expiresAt={expiresAt} />
        <Card>
          <CardHeader title={t("session.soonTitle")} description={t("session.soonBody")} />
          <CardBody>
            <ul className="flex flex-col divide-y divide-line">
              {upcoming.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.key} className="flex items-center gap-3 py-3">
                    <Icon aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
                    <span className="min-w-0 flex-1 text-body-sm font-bold text-ink-strong">
                      {t(`nav.items.${item.key}`)}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-surface-alt px-2 py-0.5 text-caption font-bold text-ink-muted">
                      <Clock aria-hidden="true" className="size-3.5" />
                      {t("nav.soon")}
                    </span>
                  </li>
                );
              })}
            </ul>
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
  const text = userText(user, locale);
  if (text.faculty) rows.push({ label: t("faculty"), value: text.faculty });
  if (user.level) rows.push({ label: t("level"), value: t("levelValue", { level: user.level }) });
  if (user.masked_phone) rows.push({ label: t("phone"), value: user.masked_phone, ltr: true });
  rows.push({ label: t("expiresAt"), value: formatDateTime(expiresAt, locale) });

  return (
    <Card elevation="raised">
      <CardHeader title={t("accountTitle")} description={text.name} />
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
