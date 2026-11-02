"use client";

import { Landmark } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { PaymentInstructions } from "../schema";
import { CopyButton } from "./copy-button";

/** The university's bank account, each number copyable, read left to right in both languages. */
export function BankDetailsCard({ instructions }: { instructions: PaymentInstructions }) {
  const t = useTranslations("student.payment.bank");
  const { bank } = instructions;
  const rows: { label: string; value: string; copy?: boolean; ltr?: boolean }[] = [
    { label: t("bankName"), value: bank.bank_name },
    { label: t("accountName"), value: bank.account_name },
    { label: t("accountNumber"), value: bank.account_number, copy: true, ltr: true },
    { label: t("iban"), value: bank.iban, copy: true, ltr: true },
    { label: t("swift"), value: bank.swift_code, copy: true, ltr: true },
    { label: t("currency"), value: bank.currency, ltr: true },
  ];

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Landmark aria-hidden="true" className="size-5 text-teal" />
            {t("title")}
          </span>
        }
        description={t("lead")}
      />
      <CardBody>
        <dl className="divide-y divide-line rounded-md border border-line">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <dt className="text-caption text-ink-muted">{row.label}</dt>
                <dd className="text-body-sm font-bold break-all text-ink-strong">
                  {row.ltr ? <bdi dir="ltr">{row.value}</bdi> : row.value}
                </dd>
              </div>
              {row.copy ? <CopyButton value={row.value} field={row.label} /> : null}
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}
