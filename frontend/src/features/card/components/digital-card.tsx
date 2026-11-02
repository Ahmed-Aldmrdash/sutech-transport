"use client";

import { RotateCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { BrandPattern } from "@/components/brand/brand-pattern";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatCalendarDate, formatClockTime } from "@/lib/format";
import { useNow } from "@/lib/hooks/use-now";
import type { StudentCard } from "../schema";
import { QrCode } from "./qr-code";

const TICK_MS = 1000;
const MS_PER_SECOND = 1000;

interface DigitalCardProps {
  card: StudentCard;
  isRefreshing: boolean;
  onRefresh: () => void;
}

/** The bus pass: who, which line and stop, valid until when, and the rotating boarding code. */
export function DigitalCard({ card, isRefreshing, onRefresh }: DigitalCardProps) {
  const t = useTranslations("student");
  const tApp = useTranslations("app");
  const locale = useLocale() as Locale;
  const now = useNow(TICK_MS);
  const secondsLeft = Math.ceil((Date.parse(card.qr.expires_at) - now) / MS_PER_SECOND);
  const isExpired = secondsLeft <= 0;
  const initials = card.student.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("");

  return (
    <article
      aria-label={t("card.pass")}
      className="mx-auto w-full max-w-md overflow-hidden rounded-lg border border-line bg-surface-raised shadow-card"
    >
      <header className="relative isolate flex items-center justify-between gap-3 overflow-hidden bg-brand px-5 py-4 text-white dark:bg-brand-soft">
        <BrandPattern className="-z-10" tone="onBrand" />
        <Logo name={tApp("shortName")} tagline={t("card.university")} variant="white" />
        <span className="shrink-0 rounded-pill bg-white/15 px-3 py-1 text-caption font-bold">
          {t("card.pass")}
        </span>
      </header>

      <div className="flex items-center gap-4 px-5 pt-5">
        <span
          aria-hidden="true"
          className="inline-flex size-16 shrink-0 items-center justify-center rounded-card bg-brand-soft text-h2 text-brand"
        >
          {initials}
        </span>
        <div className="min-w-0">
          <h2 className="text-h3 text-ink-strong">{card.student.name}</h2>
          <p className="text-body-sm text-ink">
            {t("card.identifier")}:{" "}
            <bdi dir="ltr" className="font-bold">
              {card.student.identifier}
            </bdi>
          </p>
          {card.student.faculty ? (
            <p className="text-caption text-ink-muted">
              {card.student.faculty}
              {card.student.level ? ` · ${t("card.level", { level: card.student.level })}` : ""}
            </p>
          ) : null}
        </div>
      </div>

      <dl className="mx-5 mt-4 grid grid-cols-2 gap-3 rounded-md bg-surface-alt p-3">
        <div>
          <dt className="text-caption text-ink-muted">{t("card.line")}</dt>
          <dd className="text-body-sm font-bold text-ink-strong">
            {t("lineCode", { code: card.line.code })} · {card.line.name}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-ink-muted">{t("card.stop")}</dt>
          <dd className="text-body-sm font-bold text-ink-strong">{card.stop.name}</dd>
          {card.stop.pickup_time ? (
            <dd className="text-caption text-ink">
              {t("card.pickup", { time: formatClockTime(card.stop.pickup_time, locale) })}
            </dd>
          ) : null}
        </div>
      </dl>

      <div className="flex flex-col items-center gap-3 px-5 py-5">
        <div className="relative">
          <QrCode
            value={card.qr.token}
            label={t("card.qrLabel", { name: card.student.name })}
            className={cn("size-56 rounded-md transition", isExpired && "opacity-15 blur-[2px]")}
          />
          {isExpired ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
              <p className="text-body-sm font-bold text-ink-strong">{t("card.expired")}</p>
              <Button
                size="sm"
                variant="secondary"
                iconStart={<RotateCw className="size-4" />}
                isLoading={isRefreshing}
                onClick={onRefresh}
              >
                {t("card.getNewCode")}
              </Button>
            </div>
          ) : null}
        </div>
        <p role="timer" aria-live="off" className="text-body-sm font-bold text-teal-text">
          {isExpired ? t("card.refreshing") : t("card.refreshIn", { seconds: secondsLeft })}
        </p>
        <p className="text-caption text-ink-muted">
          {t("card.validUntil", { date: formatCalendarDate(card.valid_until, locale) })} ·{" "}
          {card.term_name}
        </p>
      </div>
    </article>
  );
}
