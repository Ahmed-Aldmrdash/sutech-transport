"use client";

import { Siren } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { ButtonLink } from "@/components/ui/button";
import { SosStatus } from "@/features/sos/schema";
import { usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatNumber, formatTime } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { listAdminSos } from "../api";
import { EMERGENCIES_REFRESH_MS } from "./emergencies-page";

/** A short two-tone beep, so a new alert is heard even when the office isn't looking. */
function beep() {
  try {
    const context = new AudioContext();
    const gain = context.createGain();
    gain.gain.value = 0.15;
    gain.connect(context.destination);
    [880, 660].forEach((frequency, index) => {
      const tone = context.createOscillator();
      tone.frequency.value = frequency;
      tone.connect(gain);
      tone.start(context.currentTime + index * 0.25);
      tone.stop(context.currentTime + index * 0.25 + 0.2);
    });
    window.setTimeout(() => void context.close(), 1000);
  } catch {
    // No sound (blocked until the page is touched, or no audio device): the banner still shows.
  }
}

/**
 * On every office page of the Transportation office and the clinic: a red banner while any
 * SOS is waiting to be taken, with a beep when a new one arrives.
 */
export function SosAlarm() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const state = useAsync((signal) => listAdminSos({ status: SosStatus.Open }, { signal }), []);
  const { refresh } = state;
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    const timer = window.setInterval(refresh, EMERGENCIES_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const data = state.status === AsyncStatus.Success ? state.data : null;
  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.items.map((item) => item.id));
    // The first answer is what was already open; only alerts after that beep.
    if (seen.current && [...ids].some((id) => !seen.current?.has(id))) beep();
    seen.current = ids;
  }, [data]);

  const items = data?.items ?? [];

  const newest = items[0];
  // The emergencies pages show the alerts themselves.
  if (!newest || pathname.startsWith("/admin/emergencies")) return null;
  const others = items.length - 1;
  return (
    <div
      role="alert"
      className="mb-6 flex flex-col gap-3 rounded-card bg-danger p-4 text-on-danger sm:flex-row sm:items-center"
    >
      <Siren aria-hidden="true" className="size-7 shrink-0 motion-safe:animate-pulse" />
      <div className="min-w-0 flex-1">
        <p className="text-body font-bold">
          {t("emergencies.alarm.title", {
            type: t(`sos.types.${newest.type}.label`),
            code: newest.line.code,
          })}
        </p>
        <p className="text-body-sm">
          {t("emergencies.alarm.body", {
            time: formatTime(newest.created_at, locale),
            count: formatNumber(newest.riders_on_board, locale),
          })}
          {others > 0 ? ` · ${t("emergencies.alarm.more", { count: others })}` : null}
        </p>
      </div>
      <ButtonLink
        href={`/admin/emergencies/${encodeURIComponent(newest.id)}`}
        variant="secondary"
        className="shrink-0"
      >
        {t("emergencies.alarm.open")}
      </ButtonLink>
    </div>
  );
}
