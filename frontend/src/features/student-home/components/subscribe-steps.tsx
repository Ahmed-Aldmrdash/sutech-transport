"use client";

import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

const STEPS = ["choose", "pay", "upload", "card"] as const;

/** The four steps from "no subscription" to a working digital card. */
export function SubscribeSteps() {
  const t = useTranslations("student.home.steps");
  return (
    <Card>
      <CardHeader title={t("title")} />
      <CardBody>
        <ol className="flex flex-col gap-3">
          {STEPS.map((step, index) => (
            <li key={step} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-pill bg-brand-soft text-label text-brand"
              >
                {index + 1}
              </span>
              <span className="text-body text-ink">{t(step)}</span>
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}
