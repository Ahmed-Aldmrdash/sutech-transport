"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { listEvents } from "../api";
import { EventList } from "./event-list";

/** The Transportation office's event bus requests to Abu El Hol. */
export function EventsPage() {
  const t = useTranslations("desk.events");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("lead")}
        actions={
          <ButtonLink href="/admin/events/new" iconStart={<Plus />}>
            {t("new")}
          </ButtonLink>
        }
      />
      <EventList
        load={listEvents}
        hrefOf={(eventId) => `/admin/events/${encodeURIComponent(eventId)}`}
      />
    </div>
  );
}
