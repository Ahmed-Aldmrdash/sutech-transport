"use client";

import { useTranslations } from "next-intl";
import { Card, CardTitle } from "@/components/ui/Card";
import { PreferencesCard } from "@/features/notifications/components/PreferencesCard";
import { SettingsScreen } from "@/features/settings/components/SettingsScreen";
import { Link } from "@/i18n/navigation";

export default function Page() {
  const t = useTranslations("settings");
  return (
    <SettingsScreen>
      <PreferencesCard />
      <Card>
        <CardTitle>{t("guardianTitle")}</CardTitle>
        <p className="text-ink-muted">{t("guardianBody")}</p>
        <Link href="/student/requests?new=guardian_change" className="mt-3 inline-flex min-h-11 items-center font-bold text-brand">
          {t("guardianRequest")}
        </Link>
      </Card>
    </SettingsScreen>
  );
}
