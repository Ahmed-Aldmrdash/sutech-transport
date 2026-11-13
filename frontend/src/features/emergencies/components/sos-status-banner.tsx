"use client";

import { CircleCheck, Hand } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LiveDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SosAction, SosStatus } from "@/features/sos/schema";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";
import { useSubmit } from "@/lib/hooks/use-submit";
import { addSosAction } from "../api";
import { EmergencyErrorCode, type AdminSos } from "../schema";
import { useIsViewOnly } from "./use-office-role";

const ERRORS = Object.values(EmergencyErrorCode);

/** Not taken: a loud banner with "Take it". Taken or closed: who and when. */
export function StatusBanner({ sos, onChanged }: { sos: AdminSos; onChanged: () => void }) {
  const t = useTranslations("emergencies");
  const locale = useLocale() as Locale;
  const { submit, isSending, serverError } = useSubmit(ERRORS);
  const viewOnly = useIsViewOnly();
  const entryOf = (action: SosAction) => sos.actions.find((entry) => entry.action === action);

  if (sos.status === SosStatus.Open) {
    return (
      <div
        role="alert"
        className="flex flex-col gap-3 rounded-card bg-danger-soft p-4 text-danger-text sm:flex-row sm:items-center"
      >
        <p className="flex flex-1 items-center gap-3 text-body font-bold">
          <LiveDot className="bg-danger" />
          {t("openBanner")}
        </p>
        {serverError ? <p className="text-body-sm">{t(`errors.${serverError}`)}</p> : null}
        {viewOnly ? null : (
          <Button
            variant="danger"
            size="lg"
            isLoading={isSending}
            iconStart={<Hand className="size-5" />}
            onClick={() =>
              void submit((idempotencyKey) =>
                addSosAction(
                  sos.id,
                  { action: SosAction.Acknowledge, note: null },
                  { idempotencyKey },
                ),
              ).then(onChanged)
            }
          >
            {t("take")}
          </Button>
        )}
      </div>
    );
  }
  const closed = entryOf(SosAction.Close);
  const taken = entryOf(SosAction.Acknowledge);
  const entry = closed ?? taken;
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3 rounded-card p-4 text-body font-bold",
        closed ? "bg-success-soft text-success-text" : "bg-warning-soft text-warning-text",
      )}
    >
      <CircleCheck aria-hidden="true" className="size-6 shrink-0" />
      {entry
        ? t(closed ? "closedBy" : "takenBy", {
            name: entry.by_name ?? "",
            time: formatTime(entry.at, locale),
          })
        : null}
    </div>
  );
}
