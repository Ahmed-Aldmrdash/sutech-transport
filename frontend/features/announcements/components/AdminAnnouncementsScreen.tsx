"use client";

import { useState } from "react";
import { CalendarClock, Pin, PinOff, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { useCanEdit } from "@/components/layout/RequirePage";
import { Async } from "@/components/ui/Async";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Pill } from "@/components/ui/Pill";
import { EmptyState, useErrorMessage } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { listLines } from "@/features/lines/api";
import { combineQueries, useApi, useMutation } from "@/lib/api/use-api";
import { formatDateTime } from "@/lib/time";
import { cancelScheduled, clearDelay, deleteAnnouncement, listAdminAnnouncements, listDelays, pinAnnouncement, publishScheduled } from "../api";
import { type Announcement, AnnouncementKind } from "../schema";
import { AnnouncementCard } from "./AnnouncementCard";
import { AnnouncementForm } from "./AnnouncementForm";

export function AdminAnnouncementsScreen() {
  const t = useTranslations("admin.announcements");
  const locale = useLocale();
  const toast = useToast();
  const canEdit = useCanEdit();
  const query = combineQueries(combineQueries(useApi(listAdminAnnouncements), useApi(listDelays)), useApi(listLines));
  const pin = useMutation(pinAnnouncement);
  const remove = useMutation(deleteAnnouncement);
  const publish = useMutation(publishScheduled);
  const cancel = useMutation(cancelScheduled);
  const clear = useMutation(clearDelay);
  const error = useErrorMessage(pin.error ?? publish.error ?? cancel.error ?? clear.error);
  const removeError = useErrorMessage(remove.error);
  const [deleting, setDeleting] = useState<Announcement | null>(null);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Async query={query}>
        {([[data, delays], lines]) => (
          <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
            {canEdit && (
              <Card className="self-start">
                <CardTitle>{t("new")}</CardTitle>
                <AnnouncementForm lines={lines.items} />
              </Card>
            )}
            <div className="flex flex-col gap-4">
              {error && <p className="font-bold text-danger">{error}</p>}
              <Card>
                <CardTitle>{t("activeDelays")}</CardTitle>
                {delays.length === 0 ? (
                  <p className="text-ink-muted">{t("noDelays")}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {delays.map((delay) => (
                      <li key={delay.line_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-warning-soft p-3">
                        <span>
                          <b>{delay.line_name}</b> · {t("delayMinutes", { minutes: delay.minutes })} · {delay.reason}
                        </span>
                        {canEdit && (
                          <Button size="sm" variant="secondary" loading={clear.pending} onClick={async () => (await clear.run(delay.line_id)) && toast(t("cleared"))}>
                            {t("backOnSchedule")}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              {data.scheduled.length > 0 && (
                <Card>
                  <CardTitle>{t("scheduled")}</CardTitle>
                  <ul className="flex flex-col gap-2">
                    {data.scheduled.map((item) => (
                      <li key={item.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-line p-3">
                        <div className="min-w-0">
                          <p className="font-bold">{item.title}</p>
                          <p className="flex items-center gap-1 text-[13px] text-ink-muted">
                            <CalendarClock className="size-4" aria-hidden />
                            {formatDateTime(item.publish_at, locale)} · {item.target_name}
                            {item.is_term_opening && <Pill tone="brand">{t("termOpening")}</Pill>}
                          </p>
                        </div>
                        {canEdit && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" loading={cancel.pending} onClick={async () => (await cancel.run(item.id)) && toast(t("scheduleCancelled"))}>
                              {t("cancelSchedule")}
                            </Button>
                            <Button size="sm" variant="secondary" loading={publish.pending} onClick={async () => (await publish.run(item.id)) && toast(t("publishedNow"))}>
                              {t("publishNow")}
                            </Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              <h2 className="text-[18px] font-bold">{t("published")}</h2>
              {data.published.length === 0 && <EmptyState title={t("noneYet")} />}
              {data.published.map((item) => (
                <AnnouncementCard
                  key={item.id}
                  item={item}
                  actions={
                    canEdit && (
                      <span className="flex gap-1">
                        {item.kind === AnnouncementKind.Official && (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={item.pinned ? <PinOff className="size-4" aria-hidden /> : <Pin className="size-4" aria-hidden />}
                            onClick={() => void pin.run(item.id, !item.pinned)}
                          >
                            {item.pinned ? t("unpin") : t("pin")}
                          </Button>
                        )}
                        <Button size="sm" variant="dangerGhost" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setDeleting(item)}>
                          {t("delete")}
                        </Button>
                      </span>
                    )
                  }
                />
              ))}
            </div>
          </div>
        )}
      </Async>
      <ConfirmDialog
        open={!!deleting}
        danger
        title={t("deleteTitle")}
        confirmLabel={t("delete")}
        pending={remove.pending}
        error={removeError || undefined}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting && (await remove.run(deleting.id))) {
            setDeleting(null);
            toast(t("deleted"));
          }
        }}
      >
        <p>{t("deleteBody")}</p>
      </ConfirmDialog>
    </>
  );
}
