"use client";

import { useLocale, useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/choice";
import type { Locale } from "@/i18n/routing";
import { formatNumber, formatPhone } from "@/lib/format";
import type { CompanyRequest } from "../schema";

/** The company's free buses that day: tick up to the number asked for. */
export function BusPicker({
  available,
  picked,
  max,
  error,
  onToggle,
}: {
  available: CompanyRequest["available_buses"];
  picked: readonly string[];
  max: number;
  error?: string;
  onToggle: (busId: string, checked: boolean) => void;
}) {
  const t = useTranslations("desk.company.reply");
  const tAll = useTranslations();
  const locale = useLocale() as Locale;
  const seats = available
    .filter((bus) => picked.includes(bus.bus_id))
    .reduce((sum, bus) => sum + bus.seats, 0);
  return (
    <fieldset className="flex flex-col gap-1" aria-describedby="picked-count">
      <legend className="mb-1 text-label text-ink-strong">{t("buses")}</legend>
      {available.length === 0 ? (
        <p className="text-body-sm text-ink-muted">{t("noneFree")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line px-3 desktop:max-h-96 desktop:overflow-y-auto">
          {available.map((bus) => {
            const checked = picked.includes(bus.bus_id);
            return (
              <li key={bus.bus_id} className="py-1">
                <Checkbox
                  checked={checked}
                  disabled={!checked && picked.length >= max}
                  onChange={(change) => onToggle(bus.bus_id, change.target.checked)}
                  label={
                    <>
                      <bdi className="font-bold">{bus.plate}</bdi>
                      {" · "}
                      {tAll("desk.events.typeSeats", {
                        type: tAll(`student.busType.${bus.bus_type}`),
                        seats: formatNumber(bus.seats, locale),
                      })}
                    </>
                  }
                  description={
                    <>
                      {bus.driver_name} · <bdi dir="ltr">{formatPhone(bus.driver_phone)}</bdi>
                      {" · "}
                      {bus.line
                        ? t("onLine", { code: bus.line.code, name: bus.line.name })
                        : t("spare")}
                    </>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
      <p id="picked-count" className="mt-1 text-caption text-ink-muted" aria-live="polite">
        {t("picked", {
          picked: formatNumber(picked.length, locale),
          max: formatNumber(max, locale),
          seats: formatNumber(seats, locale),
        })}
      </p>
      {error ? (
        <p className="text-caption text-danger-text" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
