"use client";

import { useTranslations } from "next-intl";
import { TextField } from "@/components/ui/input";
import { type FieldsProps, Section } from "./model-permit-fields";

/** When the model comes in and goes out, within the term. */
export function TimesFields({
  values,
  update,
  fieldError,
  today,
  lastDay,
}: FieldsProps & { today: string; lastDay: string }) {
  const tPermit = useTranslations("student.requests.modelPermit");
  return (
    <Section title={tPermit("timesTitle")}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          type="date"
          label={tPermit("entryDate")}
          required
          min={today}
          max={lastDay}
          error={fieldError("entryDate")}
          value={values.entryDate}
          onChange={(event) => update("entryDate", event.target.value)}
        />
        <TextField
          type="time"
          label={tPermit("entryTime")}
          required
          error={fieldError("entryTime")}
          value={values.entryTime}
          onChange={(event) => update("entryTime", event.target.value)}
        />
        <TextField
          type="date"
          label={tPermit("exitDate")}
          required
          min={values.entryDate || today}
          max={lastDay}
          error={fieldError("exitDate")}
          value={values.exitDate}
          onChange={(event) => update("exitDate", event.target.value)}
        />
        <TextField
          type="time"
          label={tPermit("exitTime")}
          required
          error={fieldError("exitTime")}
          value={values.exitTime}
          onChange={(event) => update("exitTime", event.target.value)}
        />
      </div>
    </Section>
  );
}
