"use client";

import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { LanguageToggle } from "@/components/layout/PreferenceToggles";
import { useMe, useSession } from "@/components/providers/SessionProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { isMockMode } from "@/lib/config";
import { DemoReset } from "./DemoReset";

/** Account, language, theme and sign-out for every role; `children` adds role-specific sections. */
export function SettingsScreen({ children }: { children?: ReactNode }) {
  const t = useTranslations("settings");
  const tr = useTranslations("roles");
  const me = useMe();
  const { signOut } = useSession();
  const { choice, setChoice } = useTheme();
  return (
    <>
      <PageHeader title={t("title")} />
      <div className="flex flex-col gap-4">
        <Card>
          <CardTitle>{t("account")}</CardTitle>
          <dl className="grid gap-2 text-[15px]">
            <Row label={t("name")} value={me.name} />
            <Row label={t("role")} value={tr(me.role)} />
            <Row label={t("identifier")} value={me.identifier} ltr />
            {me.faculty && <Row label={t("faculty")} value={me.faculty} />}
            {me.level && <Row label={t("level")} value={me.level} />}
            {me.guardian_name && <Row label={t("guardian")} value={me.guardian_name} />}
            {me.masked_phone && <Row label={t("phone")} value={me.masked_phone} ltr />}
          </dl>
        </Card>
        <Card className="flex flex-col gap-4">
          <CardTitle className="mb-0">{t("display")}</CardTitle>
          <div className="flex items-center justify-between gap-3">
            <span className="font-bold">{t("language")}</span>
            <LanguageToggle className="border border-line-strong" />
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-bold">{t("theme")}</span>
            <Segmented
              label={t("theme")}
              value={choice}
              onChange={setChoice}
              options={[
                { value: "system", label: t("themeSystem") },
                { value: "light", label: t("themeLight") },
                { value: "dark", label: t("themeDark") },
              ]}
            />
          </div>
        </Card>
        {children}
        {isMockMode && <DemoReset />}
        <Button variant="dangerOutline" icon={<LogOut className="flip-rtl size-4" aria-hidden />} onClick={() => void signOut()}>
          {t("signOut")}
        </Button>
      </div>
    </>
  );
}

function Row({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-end font-bold text-ink-strong" dir={ltr ? "ltr" : undefined}>
        {value}
      </dd>
    </div>
  );
}
