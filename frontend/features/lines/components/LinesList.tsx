"use client";

import { ArrowLeft, Bus, MapPin, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Async } from "@/components/ui/Async";
import { Banner } from "@/components/ui/Banner";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import { getTerm } from "@/features/term/api";
import { Link } from "@/i18n/navigation";
import { combineQueries, useApi } from "@/lib/api/use-api";
import { formatMoney } from "@/lib/money";
import { formatClock } from "@/lib/time";
import { bookableStops, listLines } from "../api";
import type { Line } from "../schema";

const FEW_SEATS = 5;

export function LinesList() {
  const t = useTranslations("student.lines");
  const query = combineQueries(useApi(listLines), useApi(getTerm));
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Async query={query}>
        {([lines, term]) => (
          <div className="flex flex-col gap-3">
            {term.current.booking === "closed" && <Banner tone="warning">{t("bookingClosed")}</Banner>}
            {lines.items.length === 0 && <EmptyState title={t("empty")} />}
            {lines.items.map((line) => (
              <LineCard key={line.id} line={line} />
            ))}
          </div>
        )}
      </Async>
    </>
  );
}

function LineCard({ line }: { line: Line }) {
  const t = useTranslations("student.lines");
  const locale = useLocale();
  const stops = bookableStops(line);
  const first = stops[0];
  const full = line.seats_left === 0;
  return (
    <Link href={`/student/lines/${line.id}`} className="block rounded-card focus-visible:outline-2">
      <Card className="flex flex-col gap-3 transition-colors hover:border-brand">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[18px] font-bold text-ink-strong">{line.name}</h2>
            <p className="mt-0.5 flex items-center gap-1 text-[14px] text-ink-muted">
              <MapPin className="size-4 shrink-0" aria-hidden />
              {t("stopsCount", { count: stops.length })}
              {first && ` · ${t("firstPickup", { time: formatClock(first.time, locale) })}`}
            </p>
          </div>
          <p className="num shrink-0 text-[18px] font-extrabold text-brand">{formatMoney(line.price, locale)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {full ? (
            <Pill tone="danger">{t("full")}</Pill>
          ) : (
            <Pill tone={line.seats_left <= FEW_SEATS ? "warning" : "success"} icon={<Users className="size-3" aria-hidden />}>
              {t("seatsLeft", { count: line.seats_left })}
            </Pill>
          )}
          {line.bus_type && (
            <Pill icon={<Bus className="size-3" aria-hidden />}>{line.bus_type}</Pill>
          )}
          <Pill tone="neutral">{t(`operator.${line.operator}`)}</Pill>
          <ArrowLeft className="flip-rtl ms-auto size-5 text-ink-muted" aria-hidden />
        </div>
      </Card>
    </Link>
  );
}
