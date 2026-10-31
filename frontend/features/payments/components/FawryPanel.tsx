"use client";

import { useState } from "react";
import { Copy, Receipt } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { useErrorMessage } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useMutation } from "@/lib/api/use-api";
import { isMockMode } from "@/lib/config";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { createFawryCode, simulateFawryPaid } from "../api";
import type { FawryCode } from "../schema";

/** Fawry: the student gets a reference code to pay at any Fawry outlet; Fawry's callback activates the subscription. */
export function FawryPanel() {
  const t = useTranslations("student.payment");
  const locale = useLocale();
  const toast = useToast();
  const code = useMutation(createFawryCode);
  const paid = useMutation(simulateFawryPaid);
  const [result, setResult] = useState<FawryCode | undefined>();
  const error = useErrorMessage(code.error ?? paid.error);

  if (!result) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-ink-muted">{t("fawryBody")}</p>
        {error && <Banner tone="danger">{error}</Banner>}
        <Button icon={<Receipt className="size-4" aria-hidden />} loading={code.pending} onClick={async () => setResult(await code.run())}>
          {t("fawryGet")}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md bg-surface-alt p-4 text-center">
        <p className="text-[14px] text-ink-muted">{t("fawryCode")}</p>
        <p className="num mt-1 text-[32px] leading-10 font-extrabold tracking-widest text-ink-strong" dir="ltr">
          {result.code}
        </p>
        <p className="mt-1 font-bold">{formatMoney(result.amount, locale)}</p>
        <p className="text-[13px] text-ink-muted">{t("fawryExpires", { at: formatDateTime(result.expires_at, locale) })}</p>
      </div>
      <Button
        variant="secondary"
        icon={<Copy className="size-4" aria-hidden />}
        onClick={async () => {
          await navigator.clipboard?.writeText(result.code);
          toast(t("copied"));
        }}
      >
        {t("copy")}
      </Button>
      <p className="text-[14px] text-ink-muted">{t("fawryAfter")}</p>
      {isMockMode && (
        <Button variant="ghost" loading={paid.pending} onClick={async () => (await paid.run()) && toast(t("activated"))}>
          {t("simulatePaid")}
        </Button>
      )}
      {error && <Banner tone="danger">{error}</Banner>}
    </div>
  );
}
