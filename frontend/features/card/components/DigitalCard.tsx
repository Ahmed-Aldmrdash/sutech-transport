"use client";

import { useEffect } from "react";
import Image from "next/image";
import { QrCode, RefreshCw, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Async } from "@/components/ui/Async";
import { useApi } from "@/lib/api/use-api";
import { ErrorCode } from "@/lib/api/errors";
import { formatDate } from "@/lib/time";
import { useNow } from "@/lib/use-now";
import { SubscribersOnly } from "@/features/subscriptions/components/SubscribersOnly";
import { getMyCard } from "../api";
import type { DigitalCard as Card } from "../schema";
import { QrImage } from "./QrImage";

/** Refresh a little before the token expires so the code on screen is always valid. */
const REFRESH_EARLY_MS = 3000;

export function DigitalCard() {
  const t = useTranslations("student.card");
  const query = useApi(getMyCard);
  const notSubscribed = query.error?.code === ErrorCode.SubscriptionRequired;
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {notSubscribed ? (
        <SubscribersOnly icon={<QrCode aria-hidden />} title={t("inactiveTitle")} body={t("inactiveBody")} />
      ) : (
        <Async query={query}>{(card) => <CardFace card={card} reload={query.reload} />}</Async>
      )}
    </>
  );
}

function CardFace({ card, reload }: { card: Card; reload: () => void }) {
  const t = useTranslations("student.card");
  const locale = useLocale();
  const now = useNow(1000);
  const left = Math.max(0, Math.ceil((new Date(card.qr_expires_at).getTime() - now.getTime()) / 1000));

  useEffect(() => {
    const wait = new Date(card.qr_expires_at).getTime() - Date.now() - REFRESH_EARLY_MS;
    const id = setTimeout(reload, Math.max(0, wait));
    return () => clearTimeout(id);
  }, [card.qr_expires_at, reload]);

  return (
    <div className="mx-auto flex max-w-sm flex-col overflow-hidden rounded-lg bg-surface-raised shadow-card">
      <div className="relative overflow-hidden bg-[image:var(--grad-brand)] px-5 py-5 text-white">
        <div aria-hidden className="absolute inset-0 bg-[url('/brand/pattern.svg')]" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="label-caps text-[12px] text-purple-20">{t("cardLabel", { term: card.term_name })}</p>
            <p className="mt-1 text-[22px] leading-7 font-extrabold">{card.name}</p>
            <p className="num mt-0.5 text-[15px] opacity-90" dir="ltr">
              {card.student_id}
            </p>
          </div>
          <Image src="/brand/sutech-mark-white.svg" alt="" width={40} height={40} className="size-10 shrink-0" />
        </div>
      </div>
      <div className="flex flex-col gap-4 p-5">
        <QrImage value={card.qr_token} label={t("qrLabel")} />
        <p className="flex items-center justify-center gap-1.5 text-[14px] text-ink-muted" aria-live="polite">
          <RefreshCw className="size-4" aria-hidden />
          {t("refreshesIn", { seconds: left })}
        </p>
        <dl className="grid grid-cols-2 gap-3 text-[14px]">
          <Item label={t("faculty")} value={card.faculty} />
          <Item label={t("level")} value={card.level} />
          <Item label={t("line")} value={card.line_name} />
          <Item label={t("stop")} value={card.stop_name} />
        </dl>
        <p className="flex items-center gap-1.5 rounded-md bg-success-soft px-3 py-2 text-[14px] font-bold text-success-text">
          <ShieldCheck className="size-4" aria-hidden />
          {t("validUntil", { date: formatDate(card.valid_until, locale) })}
        </p>
        <p className="text-center text-[13px] text-ink-muted">{t("noScreenshot")}</p>
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-bold text-ink-strong">{value}</dd>
    </div>
  );
}
