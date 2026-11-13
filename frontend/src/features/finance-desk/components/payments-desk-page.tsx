"use client";

import { CreditCard, Receipt } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { DeskListState } from "@/features/desk-kit/components/desk-list-state";
import { DeskPager } from "@/features/desk-kit/components/desk-pager";
import { DeskRow } from "@/features/desk-kit/components/desk-row";
import { DeskSearch } from "@/features/desk-kit/components/desk-search";
import { PaymentStatus } from "@/features/payments/schema";
import type { Locale } from "@/i18n/routing";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { useAsync } from "@/lib/hooks/use-async";
import { listOfficePayments } from "../api";
import type { OfficePayment, OfficePaymentList } from "../schema";
import { PaymentBadge } from "./payment-badge";
import { VisaDialog } from "./visa-dialog";

const PAGE_SIZE = 20;
const ALL = "all";
type Filter = PaymentStatus | typeof ALL;

/** Finance's queue: receipts waiting for a decision first, then the decided ones. */
export function PaymentsDeskPage() {
  const t = useTranslations("desk.payments");
  const locale = useLocale() as Locale;
  const [filter, setFilter] = useState<Filter>(PaymentStatus.PendingReview);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [isVisaOpen, setVisaOpen] = useState(false);
  const state = useAsync(
    (signal) =>
      listOfficePayments(
        {
          status: filter === ALL ? undefined : filter,
          q: query || undefined,
          page,
          page_size: PAGE_SIZE,
        },
        { signal },
      ),
    [filter, query, page],
  );
  const onSearch = useCallback((value: string) => {
    setQuery(value);
    setPage(1);
  }, []);
  const counts = state.data?.counts;
  // "(…)" holds the count's place until it arrives: the chips keep their width, so on a phone
  // they don't wrap to a new row and push the search box down (layout shift).
  const label = (key: PaymentStatus) =>
    `${t(`filters.${key}`)} (${counts ? formatNumber(counts[key], locale) : "…"})`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("lead")}
        actions={
          <Button iconStart={<CreditCard />} onClick={() => setVisaOpen(true)}>
            {t("visa.open")}
          </Button>
        }
      />
      <div className="flex flex-col gap-4 desktop:flex-row desktop:items-end desktop:justify-between">
        <FilterChips
          label={t("filters.label")}
          value={filter}
          onChange={(value) => {
            setFilter(value);
            setPage(1);
          }}
          options={[
            { value: PaymentStatus.PendingReview, label: label(PaymentStatus.PendingReview) },
            { value: PaymentStatus.Approved, label: label(PaymentStatus.Approved) },
            { value: PaymentStatus.Rejected, label: label(PaymentStatus.Rejected) },
            { value: ALL, label: t("filters.all") },
          ]}
        />
        <DeskSearch hint={t("searchHint")} onSearch={onSearch} />
      </div>
      <DeskListState state={state}>
        {(data: OfficePaymentList) =>
          data.items.length === 0 ? (
            <EmptyState
              icon={<Receipt />}
              title={query ? t("empty.searchTitle") : t(`empty.${filter}`)}
              description={query ? t("empty.searchBody") : undefined}
            />
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {data.items.map((payment) => (
                  <li key={payment.payment_id}>
                    <PaymentRow payment={payment} />
                  </li>
                ))}
              </ul>
              <DeskPager page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
            </>
          )
        }
      </DeskListState>
      {isVisaOpen ? (
        <VisaDialog
          onClose={() => setVisaOpen(false)}
          onRecorded={() => {
            setVisaOpen(false);
            state.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function PaymentRow({ payment }: { payment: OfficePayment }) {
  const t = useTranslations("desk.payments");
  const locale = useLocale() as Locale;
  const isWaiting = payment.status === PaymentStatus.PendingReview;
  return (
    <DeskRow
      href={`/admin/payments/${encodeURIComponent(payment.payment_id)}`}
      icon={payment.method === "card_at_office" ? <CreditCard /> : <Receipt />}
      title={
        <>
          {payment.student.name} · <bdi>{payment.student.identifier}</bdi>
        </>
      }
      badge={<PaymentBadge status={payment.status} />}
      highlight={isWaiting}
      muted={!isWaiting}
      lines={[
        t("row.summary", {
          amount: formatMoney(payment.amount_piasters, locale),
          method: t(`methods.${payment.method}`),
          reference: payment.reference_number,
        }),
        [
          t("row.line", { code: payment.line.code, name: payment.line.name }),
          t("row.sent", { time: formatDateTime(payment.submitted_at, locale) }),
          payment.reviewed_by_name ? t("row.by", { name: payment.reviewed_by_name }) : null,
        ]
          .filter(Boolean)
          .join(" · "),
      ]}
    />
  );
}
