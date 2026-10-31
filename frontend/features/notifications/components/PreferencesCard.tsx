"use client";

import { useTranslations } from "next-intl";
import { Async } from "@/components/ui/Async";
import { Card, CardTitle } from "@/components/ui/Card";
import { useErrorMessage } from "@/components/ui/States";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { useApi, useMutation } from "@/lib/api/use-api";
import { getPreferences, savePreferences } from "../api";
import type { NotificationPreferences } from "../schema";

const KEYS: (keyof NotificationPreferences)[] = ["bus_near_stop", "delays", "official"];

/** Which notifications the student wants. Safety alerts (SOS, check-out) can't be turned off. */
export function PreferencesCard() {
  const t = useTranslations("settings.preferences");
  const toast = useToast();
  const query = useApi(getPreferences);
  const save = useMutation(savePreferences);
  const error = useErrorMessage(save.error);
  return (
    <Card>
      <CardTitle>{t("title")}</CardTitle>
      <Async query={query}>
        {(prefs) => (
          <div className="flex flex-col divide-y divide-line">
            {KEYS.map((key) => (
              <Switch
                key={key}
                checked={prefs[key]}
                disabled={save.pending}
                label={t(`${key}.label`)}
                description={t(`${key}.description`)}
                onChange={async (value) => {
                  if (await save.run({ ...prefs, [key]: value })) toast(t("saved"));
                }}
              />
            ))}
            <p className="pt-3 text-[13px] text-ink-muted">{t("alwaysOn")}</p>
            {error && <p className="pt-2 text-[14px] font-bold text-danger">{error}</p>}
          </div>
        )}
      </Async>
    </Card>
  );
}
