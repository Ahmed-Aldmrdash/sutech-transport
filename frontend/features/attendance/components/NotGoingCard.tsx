"use client";

import { useState } from "react";
import { CalendarX, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useErrorMessage } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useMutation } from "@/lib/api/use-api";
import { skipToday, unskipToday } from "../api";
import { AttendanceEventType, type DayRecord } from "../schema";

const ON_BUS: readonly string[] = [AttendanceEventType.Boarded, AttendanceEventType.Arrived, AttendanceEventType.Absent, AttendanceEventType.CheckedOut];

/** "Not going today": tells the driver, the office and the parent. Can be taken back until the student boards. */
export function NotGoingCard({ day }: { day: DayRecord }) {
  const t = useTranslations("student.day");
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const skip = useMutation(skipToday);
  const unskip = useMutation(unskipToday);
  const skipError = useErrorMessage(skip.error);
  const unskipError = useErrorMessage(unskip.error);
  const started = day.events.some((event) => ON_BUS.includes(event.type));
  if (started) return null;

  return (
    <Card>
      <CardTitle>{t("notGoingTitle")}</CardTitle>
      {day.skipped ? (
        <div className="flex flex-col gap-3">
          <p className="text-ink-muted">{t("skippedBody")}</p>
          {unskipError && <p className="text-[14px] font-bold text-danger">{unskipError}</p>}
          <Button
            variant="secondary"
            icon={<Undo2 className="size-4" aria-hidden />}
            loading={unskip.pending}
            onClick={async () => {
              if (await unskip.run(day.date)) toast(t("unskipped"));
            }}
          >
            {t("goingAfterAll")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-ink-muted">{t("notGoingBody")}</p>
          <Button variant="secondary" icon={<CalendarX className="size-4" aria-hidden />} onClick={() => setConfirm(true)}>
            {t("notGoingButton")}
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        title={t("confirmTitle")}
        confirmLabel={t("confirmButton")}
        pending={skip.pending}
        error={skipError || undefined}
        onClose={() => {
          setConfirm(false);
          skip.reset();
        }}
        onConfirm={async () => {
          if (await skip.run(day.date)) {
            setConfirm(false);
            toast(t("skipped"));
          }
        }}
      >
        <p>{t("confirmBody")}</p>
      </ConfirmDialog>
    </Card>
  );
}
