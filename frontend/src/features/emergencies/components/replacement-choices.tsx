"use client";

import { useLocale, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Radio } from "@/components/ui/choice";
import { Tone } from "@/components/ui/tone";
import type { BusType } from "@/features/lines/schema";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import type { ReplacementOptions } from "../schema";

interface ChoiceProps {
  options: ReplacementOptions;
  value: string;
  onChange: (id: string) => void;
}

/** A spare bus (with its own driver), warning when it has fewer seats than riders. */
export function BusChoice({ options, value, onChange }: ChoiceProps) {
  const t = useTranslations("emergencies");
  const tRoot = useTranslations();
  const locale = useLocale() as Locale;
  const busType = (type: BusType) => tRoot(`student.busType.${type}`);
  const bus = options.buses.find((item) => item.bus_id === value);
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-body-sm font-bold text-ink-strong">
        {t("replacementDialog.pickBus")}
      </legend>
      {options.buses.length === 0 ? (
        <Alert tone={Tone.Warning} title={t("replacementDialog.noBuses")} />
      ) : (
        options.buses.map((item) => (
          <Radio
            key={item.bus_id}
            name="replacement-bus"
            label={t("replacementDialog.busOption", {
              plate: item.plate,
              type: busType(item.bus_type),
              seats: formatNumber(item.seats, locale),
            })}
            description={t("replacementDialog.busDriver", { name: item.driver.name })}
            checked={value === item.bus_id}
            onChange={() => onChange(item.bus_id)}
          />
        ))
      )}
      {bus && bus.seats < options.riders ? (
        <Alert
          tone={Tone.Warning}
          title={t("replacementDialog.seatsWarning", {
            seats: formatNumber(bus.seats, locale),
            riders: formatNumber(options.riders, locale),
          })}
        />
      ) : null}
    </fieldset>
  );
}

/** A spare driver for the same bus. */
export function DriverChoice({ options, value, onChange }: ChoiceProps) {
  const t = useTranslations("emergencies");
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-body-sm font-bold text-ink-strong">
        {t("replacementDialog.pickDriver")}
      </legend>
      {options.drivers.length === 0 ? (
        <Alert tone={Tone.Warning} title={t("replacementDialog.noDrivers")} />
      ) : (
        options.drivers.map((item) => (
          <Radio
            key={item.driver_id}
            name="replacement-driver"
            label={item.name}
            checked={value === item.driver_id}
            onChange={() => onChange(item.driver_id)}
          />
        ))
      )}
    </fieldset>
  );
}
