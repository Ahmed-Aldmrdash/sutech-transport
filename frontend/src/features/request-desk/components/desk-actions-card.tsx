"use client";

import { Check, FolderOpen, MessageSquareReply, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { TextAreaField, TextField } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Tone } from "@/components/ui/tone";
import { RequestActor, RequestKind } from "@/features/requests/schema";
import type { Locale } from "@/i18n/routing";
import { focusFirstError } from "@/lib/forms/focus-first-error";
import { PIASTERS_PER_POUND, formatMoney, formatNumber } from "@/lib/format";
import { useSubmit } from "@/lib/hooks/use-submit";
import { actOnDeskRequest } from "../api";
import {
  DESK_NOTE_MAX_LENGTH,
  DESK_NOTE_MIN_LENGTH,
  DeskAction,
  DeskErrorCode,
  type DeskRequest,
} from "../schema";

const ERRORS = Object.values(DeskErrorCode);

const ACTION_ICON = {
  [DeskAction.Open]: <FolderOpen />,
  [DeskAction.Approve]: <Check />,
  [DeskAction.Reject]: <X />,
  [DeskAction.Resolve]: <MessageSquareReply />,
};

/** The office's answer: take it, then approve / reject (or answer a complaint) with a note. */
export function DeskActionsCard({ desk, onDone }: { desk: DeskRequest; onDone: () => void }) {
  const t = useTranslations("desk.requests.act");
  const locale = useLocale() as Locale;
  const [action, setAction] = useState<DeskAction | null>(null);
  const { request } = desk;
  const seats = desk.target_seats_available;
  // A line change normally reaches the office after the guardian approved in the app. With no
  // guardian account it comes straight here, and the office confirms by phone.
  const guardianToCall =
    request.kind === RequestKind.LineChange &&
    !request.timeline.some((event) => event.by === RequestActor.Guardian)
      ? request.details
      : null;

  return (
    <Card elevation="raised" className="border-brand">
      <CardHeader title={t("title")} headingLevel={2} />
      <CardBody className="flex flex-col gap-4">
        <p className="text-body-sm text-ink">{t(`lead.${request.kind}`)}</p>
        {guardianToCall ? (
          <Alert tone={Tone.Info} title={t("callGuardian.title")}>
            {t.rich("callGuardian.body", {
              name: guardianToCall.guardian_name,
              number: guardianToCall.guardian_phone,
              phone: (chunks) => <bdi dir="ltr">{chunks}</bdi>,
            })}
          </Alert>
        ) : null}
        {request.kind === RequestKind.LineChange && seats !== null ? (
          <Alert
            tone={seats > 0 ? Tone.Success : Tone.Warning}
            title={
              seats > 0 ? t("seatsFree", { count: formatNumber(seats, locale) }) : t("seatsNone")
            }
          />
        ) : null}
        <div className="flex flex-wrap gap-3">
          {desk.allowed_actions.map((item) => (
            <Button
              key={item}
              variant={
                item === DeskAction.Reject || item === DeskAction.Open ? "secondary" : "primary"
              }
              iconStart={ACTION_ICON[item]}
              onClick={() => setAction(item)}
            >
              {t(`actions.${item}`)}
            </Button>
          ))}
        </div>
      </CardBody>
      {action ? (
        <ActionDialog
          desk={desk}
          action={action}
          onClose={() => setAction(null)}
          onDone={() => {
            setAction(null);
            onDone();
          }}
        />
      ) : null}
    </Card>
  );
}

function ActionDialog({
  desk,
  action,
  onClose,
  onDone,
}: {
  desk: DeskRequest;
  action: DeskAction;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("desk.requests.act");
  const tErrors = useTranslations("desk.requests.errors");
  const locale = useLocale() as Locale;
  const toast = useToast();
  const { request } = desk;
  const [note, setNote] = useState(desk.suggested_replies[action] ?? "");
  const refund = request.kind === RequestKind.Refund ? request.details : null;
  const isApprovingRefund = refund !== null && action === DeskAction.Approve;
  const decides = isApprovingRefund && refund.estimated_refund_piasters === null;
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState<{ note?: string; amount?: string }>({});
  const boxRef = useRef<HTMLDivElement>(null);
  const { submit, isSending, serverError } = useSubmit(ERRORS);
  const needsNote = action === DeskAction.Reject || action === DeskAction.Resolve;

  async function confirm() {
    const text = note.trim();
    const next: typeof errors = {};
    if (needsNote && text.length < DESK_NOTE_MIN_LENGTH) next.note = t("noteRequired");
    let refundPiasters: number | null = null;
    if (isApprovingRefund) {
      if (decides) {
        const pounds = Number(amount.replace(/[,\s]/g, ""));
        const max = refund.paid_piasters / PIASTERS_PER_POUND;
        if (amount.trim() === "" || !Number.isFinite(pounds) || pounds < 0 || pounds > max) {
          next.amount = t("amountInvalid", { max: formatMoney(refund.paid_piasters, locale) });
        } else {
          refundPiasters = Math.round(pounds * PIASTERS_PER_POUND);
        }
      } else {
        refundPiasters = refund.estimated_refund_piasters;
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      focusFirstError(boxRef.current);
      return;
    }
    const done = await submit(() =>
      actOnDeskRequest(request.request_id, {
        action,
        note: text || null,
        refund_piasters: refundPiasters,
      }),
    );
    if (!done) return;
    toast.show({ title: t(`done.${action}`), tone: Tone.Success });
    onDone();
  }

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      onConfirm={() => void confirm()}
      isConfirming={isSending}
      destructive={action === DeskAction.Reject}
      title={t(`dialog.${action}.title`)}
      description={t(`dialog.${action}.body`)}
      confirmLabel={t(`actions.${action}`)}
    >
      <div ref={boxRef} className="flex flex-col gap-4">
        {isApprovingRefund ? (
          decides ? (
            <TextField
              label={t("amountLabel")}
              hint={t("amountHint", { paid: formatMoney(refund.paid_piasters, locale) })}
              required
              inputMode="decimal"
              dir="ltr"
              value={amount}
              error={errors.amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          ) : (
            <Alert
              tone={Tone.Info}
              title={t("amountFixed", {
                amount: formatMoney(refund.estimated_refund_piasters ?? 0, locale),
              })}
            />
          )
        ) : null}
        <TextAreaField
          label={t("noteLabel")}
          hint={`${needsNote ? t("noteHintRequired") : t("noteHint")} ${t(`replyIn.${desk.reply_language}`)}`}
          lang={desk.reply_language}
          dir={desk.reply_language === "ar" ? "rtl" : "ltr"}
          required={needsNote}
          optionalText={needsNote ? undefined : t("optional")}
          maxLength={DESK_NOTE_MAX_LENGTH}
          rows={4}
          value={note}
          error={errors.note}
          onChange={(event) => setNote(event.target.value)}
        />
        {serverError ? <Alert tone={Tone.Danger} title={tErrors(serverError)} /> : null}
      </div>
    </ConfirmDialog>
  );
}
