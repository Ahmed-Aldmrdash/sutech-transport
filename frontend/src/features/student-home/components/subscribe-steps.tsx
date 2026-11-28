"use client";

import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useIsEmployee } from "@/features/auth/session/use-is-employee";

const STUDENT_STEPS = ["choose", "pay", "upload", "card"] as const;
/** Staff pay nothing, so booking opens the card at once. */
const STAFF_STEPS = ["choose", "card"] as const;

/** The steps from "no subscription" to a working digital card. */
export function SubscribeSteps() {
  const t = useTranslations("student.home.steps");
  const isEmployee = useIsEmployee();
  const steps = isEmployee ? STAFF_STEPS : STUDENT_STEPS;
  return (
    <Card>
      <CardHeader title={t("title")} />
      <CardBody className="flex flex-col gap-3">
        {isEmployee ? <p className="text-body-sm text-ink-muted">{t("freeNote")}</p> : null}
        <ol className="flex flex-col gap-3">
          {steps.map((step, index) => (
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
