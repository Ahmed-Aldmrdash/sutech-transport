"use client";

import { ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Async } from "@/components/ui/Async";
import { Banner } from "@/components/ui/Banner";
import { Card } from "@/components/ui/Card";
import { Pill, type Tone } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import { useApi, usePolling } from "@/lib/api/use-api";
import { useLive } from "@/lib/realtime";
import { formatDateTime } from "@/lib/time";
import { listSos } from "../api";
import type { Sos } from "../schema";
import { SosActions } from "./SosActions";
import { SosLog } from "./SosLog";

const REFRESH_MS = 5000;
const STATUS_TONE: Record<Sos["status"], Tone> = { new: "danger", acknowledged: "warning", closed: "neutral" };

/** Emergency reports. New ones come first; the clinic sees medical ones only (server rule). */
export function AdminSosScreen() {
  const t = useTranslations("admin.sos");
  const query = useApi(listSos);
  usePolling(query.reload, REFRESH_MS);
  useLive("sos.new", () => undefined);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Async query={query}>
        {(items) => {
          const open = items.filter((item) => item.status !== "closed");
          const closed = items.filter((item) => item.status === "closed");
          return (
            <div className="flex flex-col gap-4">
              {open.length === 0 && <EmptyState icon={<ShieldCheck className="size-8" aria-hidden />} title={t("noneOpen")} />}
              {open.map((sos) => (
                <SosCard key={sos.id} sos={sos} />
              ))}
              {closed.length > 0 && <h2 className="mt-2 text-[18px] font-bold">{t("history")}</h2>}
              {closed.map((sos) => (
                <SosCard key={sos.id} sos={sos} />
              ))}
            </div>
          );
        }}
      </Async>
    </>
  );
}

function SosCard({ sos }: { sos: Sos }) {
  const t = useTranslations("admin.sos");
  const tk = useTranslations("crew.sos");
  const locale = useLocale();
  return (
    <Card as="article" raised={sos.status === "new"} className={sos.status === "new" ? "border-danger" : undefined}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={STATUS_TONE[sos.status]}>{tk(`status.${sos.status}`)}</Pill>
            <Pill tone="danger">{tk(`kinds.${sos.kind}`)}</Pill>
            <span className="num text-[13px] text-ink-muted">#{sos.id}</span>
          </div>
          <h3 className="text-[18px] font-bold text-ink-strong">{sos.line_name}</h3>
          <p className="text-[14px] text-ink-muted">
            <bdi>{sos.bus_plate}</bdi> · {sos.driver_name} · {formatDateTime(sos.created_at, locale)}
          </p>
          {sos.note && <p className="rounded-md bg-surface-alt p-3">{sos.note}</p>}
          {sos.position && (
            <a
              className="text-[14px] font-bold text-brand underline"
              href={`https://www.google.com/maps?q=${sos.position.lat},${sos.position.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              {t("openMap")}
            </a>
          )}
          {sos.ambulance_requested && <Banner tone="info">{tk("ambulance")}</Banner>}
          {sos.replacement_bus_plate && <Banner tone="info">{tk("replacement", { plate: sos.replacement_bus_plate })}</Banner>}
          <SosActions sos={sos} />
        </div>
        <div>
          <p className="mb-2 font-bold">{t("log")}</p>
          <SosLog log={sos.log} />
        </div>
      </div>
    </Card>
  );
}
