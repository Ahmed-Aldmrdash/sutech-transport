"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Async } from "@/components/ui/Async";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Segmented } from "@/components/ui/Segmented";
import { useErrorMessage } from "@/components/ui/States";
import { cancelReservation, getMySubscription } from "@/features/subscriptions/api";
import { SubscriptionCard } from "@/features/subscriptions/components/SubscriptionCard";
import { PaymentMethod, SubscriptionStatus } from "@/features/subscriptions/schema";
import { getTerm } from "@/features/term/api";
import { Link } from "@/i18n/navigation";
import { combineQueries, useApi, useMutation } from "@/lib/api/use-api";
import { formatMoney } from "@/lib/money";
import { formatCountdown, useNow } from "@/lib/use-now";
import { FawryPanel } from "./FawryPanel";
import { ReceiptForm } from "./ReceiptForm";

export function PaymentScreen() {
  const t = useTranslations("student.payment");
  const locale = useLocale();
  const now = useNow();
  const query = combineQueries(useApi(getMySubscription), useApi(getTerm));
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.Fawry);
  const [confirm, setConfirm] = useState(false);
  const cancel = useMutation(cancelReservation);
  const cancelError = useErrorMessage(cancel.error);

  return (
    <>
      <PageHeader title={t("title")} back="/student" backLabel={t("back")} />
      <Async query={query}>
        {([sub, term]) => {
          if (sub.status !== SubscriptionStatus.Reserved || !sub.reserved_until || sub.price === null) {
            return (
              <div className="flex flex-col gap-4">
                <SubscriptionCard subscription={sub} term={term} />
                {sub.status === SubscriptionStatus.None && (
                  <Link href="/student/lines" className="text-center font-bold text-brand">
                    {t("pickLineFirst")}
                  </Link>
                )}
              </div>
            );
          }
          return (
            <div className="flex flex-col gap-4">
              <Card raised className="flex flex-col gap-2">
                <p className="text-ink-muted">{t("summary", { line: sub.line_name ?? "", stop: sub.stop_name ?? "" })}</p>
                <p className="num text-[28px] leading-9 font-extrabold text-brand">{formatMoney(sub.price, locale)}</p>
                <p className="flex items-center gap-1.5 text-[15px] font-bold text-warning-text">
                  <Clock className="size-4" aria-hidden />
                  {t("timeLeft")}
                  <span className="num" dir="ltr">
                    {formatCountdown(sub.reserved_until, now)}
                  </span>
                </p>
              </Card>
              {sub.rejection_reason && <Banner tone="danger" title={t("rejectedTitle")}>{sub.rejection_reason}</Banner>}
              <Segmented
                label={t("method")}
                value={method}
                onChange={setMethod}
                options={[
                  { value: PaymentMethod.Fawry, label: t("fawry") },
                  { value: PaymentMethod.InstaPay, label: t("instapay") },
                  { value: PaymentMethod.BankTransfer, label: t("bank") },
                ]}
              />
              <Card>{method === PaymentMethod.Fawry ? <FawryPanel /> : <ReceiptForm key={method} method={method} />}</Card>
              <Button variant="dangerGhost" onClick={() => setConfirm(true)}>
                {t("cancelReservation")}
              </Button>
              <ConfirmDialog
                open={confirm}
                danger
                title={t("cancelTitle")}
                confirmLabel={t("cancelConfirm")}
                pending={cancel.pending}
                error={cancelError || undefined}
                onClose={() => setConfirm(false)}
                onConfirm={async () => {
                  if (await cancel.run()) setConfirm(false);
                }}
              >
                <p>{t("cancelBody")}</p>
              </ConfirmDialog>
            </div>
          );
        }}
      </Async>
    </>
  );
}
