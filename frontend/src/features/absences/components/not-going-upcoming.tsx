"use client";

import { Undo2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Tone } from "@/components/ui/tone";
import { useToast } from "@/components/ui/toast";
import type { Locale } from "@/i18n/routing";
import { formatCalendarDate, todayInCairo } from "@/lib/format";
import { useSubmit } from "@/lib/hooks/use-submit";
import { cancelAbsence } from "../api";
import { AbsenceErrorCode, type Absence } from "../schema";

export const SERVER_ERRORS = Object.values(AbsenceErrorCode);

export function Upcoming({ items, onChanged }: { items: Absence[]; onChanged: () => void }) {
  const t = useTranslations("student.notGoing");
  return (
    <Card>
      <CardHeader title={t("upcomingTitle")} description={t("upcomingLead")} />
      <CardBody>
        {items.length === 0 ? (
          <p className="text-body-sm text-ink-muted">{t("upcomingEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <UpcomingItem key={item.absence_id} item={item} onChanged={onChanged} />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function UpcomingItem({ item, onChanged }: { item: Absence; onChanged: () => void }) {
  const t = useTranslations("student.notGoing");
  const locale = useLocale() as Locale;
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const { submit, isSending, serverError } = useSubmit(SERVER_ERRORS);
  // The list is re-read after each change; the server refuses a late cancel anyway.
  const [loadedAt] = useState(() => Date.now());
  const canCancel = Date.parse(item.cutoff_at) > loadedAt;
  const day =
    item.service_date === todayInCairo()
      ? t("today")
      : formatCalendarDate(item.service_date, locale, "full");

  async function takeBack() {
    const done = await submit((idempotencyKey) =>
      cancelAbsence(item.absence_id, { idempotencyKey }),
    );
    setConfirming(false);
    if (done) {
      toast.show({ title: t("cancelledTitle"), tone: Tone.Success });
      onChanged();
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-md border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-body font-bold text-ink-strong">{day}</p>
          <p className="text-body-sm text-ink">
            {t(`reasons.${item.reason}`)}
            {item.note ? ` · ${item.note}` : ""}
          </p>
        </div>
        {canCancel ? (
          <Button
            variant="secondary"
            size="sm"
            iconStart={<Undo2 className="size-4" />}
            onClick={() => setConfirming(true)}
          >
            {t("cancel")}
          </Button>
        ) : null}
      </div>
      {serverError ? <Alert tone={Tone.Danger} title={t(`errors.${serverError}`)} /> : null}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void takeBack()}
        isConfirming={isSending}
        title={t("cancelConfirmTitle", { day })}
        description={t("cancelConfirmBody")}
        confirmLabel={t("cancelConfirm")}
        cancelLabel={t("keep")}
      />
    </li>
  );
}
