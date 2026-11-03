"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/ui/page-header";
import { getMyTracking } from "../api";
import { TrackingPanel } from "./tracking-panel";

/** "Track my bus": the student's own bus, live. */
export function StudentTrackingPage() {
  const t = useTranslations("tracking");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("studentTitle")} description={t("studentLead")} />
      <TrackingPanel
        load={(signal) => getMyTracking({ signal })}
        loadKey="me"
        audience={{ who: "self" }}
        linesHref="/student/lines"
      />
    </div>
  );
}
