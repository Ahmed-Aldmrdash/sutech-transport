"use client";

import { useState } from "react";
import { FilePlus2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Async } from "@/components/ui/Async";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { getMySubscription } from "@/features/subscriptions/api";
import { isActive } from "@/features/subscriptions/schema";
import { getTerm } from "@/features/term/api";
import { combineQueries, useApi } from "@/lib/api/use-api";
import { listMyRequests } from "../api";
import { RequestType, isOpen } from "../schema";
import { NewRequestForm } from "./NewRequestForm";
import { RequestCard } from "./RequestCard";

const TYPES = Object.values(RequestType) as string[];

export function MyRequestsScreen() {
  const t = useTranslations("requests");
  const toast = useToast();
  const search = useSearchParams();
  const asked = search.get("new");
  const [open, setOpen] = useState(!!asked && TYPES.includes(asked));
  const requests = useApi(listMyRequests);
  const context = combineQueries(useApi(getMySubscription), useApi(getTerm));
  const query = combineQueries(requests, context);

  return (
    <Async query={query}>
      {([list, [subscription, term]]) => {
        const hasOpen = list.items.some(isOpen);
        return (
          <>
            <PageHeader
              title={t("title")}
              subtitle={t("subtitle")}
              actions={
                <Button size="sm" icon={<FilePlus2 className="size-4" aria-hidden />} disabled={hasOpen} onClick={() => setOpen(true)}>
                  {t("new")}
                </Button>
              }
            />
            <div className="flex flex-col gap-3">
              {hasOpen && <Banner tone="info">{t("oneOpen")}</Banner>}
              {list.items.length === 0 && <EmptyState title={t("empty")}>{t("emptyBody")}</EmptyState>}
              {list.items.map((request) => (
                <RequestCard key={request.id} request={request} />
              ))}
            </div>
            <Dialog open={open && !hasOpen} onClose={() => setOpen(false)} title={t("new")}>
              <NewRequestForm
                initialType={(asked && TYPES.includes(asked) ? asked : RequestType.Refund) as RequestType}
                subscription={subscription}
                term={term}
                active={isActive(subscription)}
                onDone={() => {
                  setOpen(false);
                  toast(t("sent"));
                }}
              />
            </Dialog>
          </>
        );
      }}
    </Async>
  );
}
