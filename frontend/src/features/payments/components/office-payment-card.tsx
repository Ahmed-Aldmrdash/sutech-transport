"use client";

import { CreditCard } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { PaymentInstructions } from "../schema";

/** Paying by Visa at the Accounting office: nothing to upload, finance records it. */
export function OfficePaymentCard({ instructions }: { instructions: PaymentInstructions }) {
  const t = useTranslations("student.payment.office");
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <CreditCard aria-hidden="true" className="size-5 text-teal" />
            {t("title")}
          </span>
        }
      />
      <CardBody className="flex flex-col gap-2 text-body-sm text-ink">
        <p>{t("body", { room: instructions.cashier_room, hours: instructions.office_hours })}</p>
        <p className="text-ink-muted">{t("after", { room: instructions.transport_room })}</p>
      </CardBody>
    </Card>
  );
}
