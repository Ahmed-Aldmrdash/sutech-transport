"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { useCanEdit } from "@/components/layout/RequirePage";
import { Async } from "@/components/ui/Async";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Pill, type Tone } from "@/components/ui/Pill";
import { EmptyState, useErrorMessage } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useApi, useMutation } from "@/lib/api/use-api";
import { formatDateTime } from "@/lib/time";
import { decideViolation, listViolations } from "../api";
import type { Violation } from "../schema";

const TONE: Record<Violation["status"], Tone> = { new: "warning", referred: "danger", dismissed: "neutral" };

/** Violations reported from the buses. Student affairs refers them for action or dismisses them. */
export function AdminViolationsScreen() {
  const t = useTranslations("admin.violations");
  const tv = useTranslations("crew.violation.types");
  const locale = useLocale();
  const toast = useToast();
  const canEdit = useCanEdit();
  const query = useApi(listViolations);
  const decide = useMutation(decideViolation);
  const error = useErrorMessage(decide.error);
  const [photo, setPhoto] = useState<Violation | null>(null);
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
                    <span className="flex items-center gap-2">
                      <Pill tone="danger">{tv(item.type)}</Pill>
                      <Pill tone={TONE[item.status]}>{t(`statuses.${item.status}`)}</Pill>
                    </span>
                    <time dateTime={item.created_at} className="text-[13px] text-ink-muted">
                      {formatDateTime(item.created_at, locale)}
                    </time>
                  </div>
                  <p className="font-bold text-ink-strong">
                    {item.student_name} · <span className="num">{item.student_id}</span>
                  </p>
                  <p>{item.description}</p>
                  <p className="text-[13px] text-ink-muted">{t("reportedBy", { name: item.reported_by })}</p>
                  <div className="flex flex-wrap gap-2">
                    {item.photo && (
                      <Button size="sm" variant="ghost" onClick={() => setPhoto(item)}>
                        {t("photo")}
                      </Button>
                    )}
                    {canEdit && item.status === "new" && (
                      <>
                        <Button size="sm" variant="danger" loading={decide.pending} onClick={async () => (await decide.run(item.id, "referred")) && toast(t("referred"))}>
                          {t("refer")}
                        </Button>
                        <Button size="sm" variant="secondary" loading={decide.pending} onClick={async () => (await decide.run(item.id, "dismissed")) && toast(t("dismissed"))}>
                          {t("dismiss")}
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )
        }
      </Async>
      <Dialog open={!!photo} onClose={() => setPhoto(null)} title={t("photo")}>
        {photo?.photo && (
          // eslint-disable-next-line @next/next/no-img-element -- crew uploads (data URLs)
          <img src={photo.photo} alt={t("photoAlt", { name: photo.student_name })} className="mx-auto max-h-[70vh] rounded-md" />
        )}
      </Dialog>
    </>
  );
}
