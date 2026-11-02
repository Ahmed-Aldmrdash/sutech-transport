"use client";

import { Languages, LogOut, Palette, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { LanguageSegmented } from "@/components/layout/locale-switcher";
import { ThemeSegmented } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import type { User } from "@/features/auth/schema";
import { userText } from "@/features/auth/user-text";
import type { Locale } from "@/i18n/routing";
import { SessionStatus } from "@/features/auth/session/session-store";
import { useSession, useSignOut } from "@/features/auth/session/use-session";

/** Account details, language, appearance (light, dark or the device's) and signing out. */
export function SettingsPage() {
  const t = useTranslations("settings");
  const session = useSession();
  const signOut = useSignOut();
  const [isConfirming, setIsConfirming] = useState(false);
  const user = session.status === SessionStatus.SignedIn ? session.session.user : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("lead")} />
      <div className="grid items-start gap-5 desktop:grid-cols-2">
        {user ? <AccountCard user={user} /> : null}
        <div className="flex flex-col gap-5">
          <SettingCard icon={<Languages />} title={t("language")} description={t("languageHint")}>
            <LanguageSegmented label={t("language")} />
          </SettingCard>
          <SettingCard icon={<Palette />} title={t("appearance")} description={t("appearanceHint")}>
            <ThemeSegmented />
          </SettingCard>
          <SettingCard icon={<LogOut />} title={t("signOutTitle")} description={t("signOutHint")}>
            <Button variant="secondary" onClick={() => setIsConfirming(true)}>
              {t("signOut")}
            </Button>
          </SettingCard>
        </div>
      </div>
      <ConfirmDialog
        open={isConfirming}
        onClose={() => setIsConfirming(false)}
        onConfirm={signOut}
        title={t("signOutConfirmTitle")}
        description={t("signOutConfirmBody")}
        confirmLabel={t("signOut")}
        cancelLabel={t("stay")}
        destructive
      />
    </div>
  );
}

function SettingCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <div className="flex gap-3">
          <span
            aria-hidden="true"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm bg-brand-soft text-brand [&_svg]:size-5"
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="text-h3 text-ink-strong">{title}</h2>
            <p className="text-body-sm text-ink-muted">{description}</p>
          </div>
        </div>
        <div>{children}</div>
      </CardBody>
    </Card>
  );
}

function AccountCard({ user }: { user: User }) {
  const t = useTranslations("settings");
  const tSession = useTranslations("session");
  const text = userText(user, useLocale() as Locale);
  const rows: { label: string; value: ReactNode }[] = [
    { label: tSession("identifier"), value: <span dir="ltr">{user.identifier}</span> },
  ];
  if (text.faculty) rows.push({ label: tSession("faculty"), value: text.faculty });
  if (user.level) {
    rows.push({ label: tSession("level"), value: tSession("levelValue", { level: user.level }) });
  }
  if (text.guardianName) rows.push({ label: t("guardian"), value: text.guardianName });
  if (user.masked_phone) {
    rows.push({ label: tSession("phone"), value: <span dir="ltr">{user.masked_phone}</span> });
  }

  return (
    <Card>
      <CardHeader title={t("account")} description={t("accountHint")} />
      <CardBody>
        <div className="mb-4 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand [&_svg]:size-6"
          >
            <UserRound />
          </span>
          <p className="min-w-0 text-body font-bold break-words text-ink-strong">{text.name}</p>
        </div>
        <dl className="flex flex-col divide-y divide-line">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-wrap justify-between gap-2 py-2.5">
              <dt className="text-body-sm text-ink-muted">{row.label}</dt>
              <dd className="text-body-sm font-bold text-ink-strong">{row.value}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}
