"use client";

import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Async } from "@/components/ui/Async";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, useErrorMessage } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useApi, useMutation } from "@/lib/api/use-api";
import { formatDate } from "@/lib/time";
import { companyDecide, listCompanyRequests } from "../api";
import { EventStatusPill } from "./EventStatusPill";

/** The bus company's portal: requests for extra buses for university events. */
export function BusCompanyScreen() {
  const t = useTranslations("admin.busCompany");
  const te = useTranslations("admin.events");
  const locale = useLocale();
  const toast = useToast();
  const query = useApi(listCompanyRequests);
  const decide = useMutation(companyDecide);
  const error = useErrorMessage(decide.error);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {error && <Banner tone="danger" className="mb-3">{error}</Banner>}
      <Async query={query}>
        {(items) =>
          items.length === 0 ? (
            <EmptyState title={t("empty")} />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {items.map((item) => (
                <Card as="article" key={item.id} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-bold text-ink-strong">{item.name}</h3>
                    <EventStatusPill status={item.status} />
                  </div>
                  <p className="text-[14px] text-ink-muted">{formatDate(item.date, locale, true)}</p>
                  <p className="text-[18px] font-extrabold text-brand">{t("busesRequested", { count: item.company_buses })}</p>
                  <p className="text-[14px] text-ink-muted">{te("studentsCount", { count: item.students })}</p>
                  {item.status === "awaiting_company" && (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="dangerGhost" loading={decide.pending} onClick={async () => (await decide.run(item.id, false)) && toast(t("declined"))}>
                        {t("decline")}
                      </Button>
                      <Button size="sm" loading={decide.pending} onClick={async () => (await decide.run(item.id, true)) && toast(t("accepted"))}>
                        {t("accept")}
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )
        }
      </Async>
    </>
  );
}
