"use client";

import { useTranslations } from "next-intl";
import { Radio } from "@/components/ui/choice";
import { TextField } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { getLine } from "@/features/lines/api";
import type { Line } from "@/features/lines/schema";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import type { LineChangeField, LineChangeValues } from "../request-validation";
import { LineChangeDuration } from "../schema";

interface FieldsProps {
  values: LineChangeValues;
  update: <K extends LineChangeField>(key: K, value: LineChangeValues[K]) => void;
  fieldError: (key: LineChangeField) => string | undefined;
}

/** The new line and stop. The stop list loads when a line is picked. */
export function DestinationFields({
  lines,
  currentLineId,
  values,
  update,
  fieldError,
}: FieldsProps & { lines: readonly Line[]; currentLineId: string }) {
  const t = useTranslations("student");
  const tForm = useTranslations("student.requests");
  // The stops of the chosen line, loaded when the line changes.
  const stops = useAsync(
    (signal) => (values.toLineId ? getLine(values.toLineId, { signal }) : Promise.resolve(null)),
    [values.toLineId],
  );

  const lineOptions = lines
    .filter((line) => line.line_id !== currentLineId)
    .map((line) => ({
      value: line.line_id,
      label: tForm("lineChange.lineOption", {
        line: `${t("lineCode", { code: line.code })} · ${line.name}`,
        seats: line.seats_available,
      }),
    }));
  const stopOptions =
    stops.status === AsyncStatus.Success && stops.data
      ? stops.data.stops.map((stop) => ({ value: stop.stop_id, label: stop.name }))
      : [];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <SelectField
        label={tForm("lineChange.toLine")}
        hint={tForm("lineChange.toLineHint")}
        placeholder={tForm("lineChange.chooseLine")}
        options={lineOptions}
        required
        error={fieldError("toLineId")}
        value={values.toLineId}
        onChange={(event) => {
          update("toLineId", event.target.value);
          update("toStopId", "");
        }}
      />
      <SelectField
        label={tForm("lineChange.toStop")}
        hint={tForm("lineChange.toStopHint")}
        placeholder={
          stops.status === AsyncStatus.Loading && values.toLineId
            ? tForm("lineChange.loadingStops")
            : tForm("lineChange.chooseStop")
        }
        options={stopOptions}
        required
        disabled={!values.toLineId || stopOptions.length === 0}
        error={fieldError("toStopId")}
        value={values.toStopId}
        onChange={(event) => update("toStopId", event.target.value)}
      />
    </div>
  );
}

/** For good or for a while, and from (and until) when, within the term. */
export function WhenFields({
  values,
  update,
  fieldError,
  today,
  lastDay,
}: FieldsProps & { today: string; lastDay: string }) {
  const tForm = useTranslations("student.requests");
  return (
    <>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-body-sm font-bold text-ink-strong">
          {tForm("lineChange.duration")}
        </legend>
        <div className="flex flex-wrap gap-x-6">
          {[LineChangeDuration.Permanent, LineChangeDuration.Temporary].map((duration) => (
            <Radio
              key={duration}
              name="duration"
              value={duration}
              label={tForm(`lineChange.${duration}`)}
              description={tForm(`lineChange.${duration}Hint`)}
              checked={values.duration === duration}
              onChange={() => update("duration", duration)}
            />
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          type="date"
          label={tForm("lineChange.startsOn")}
          required
          min={today}
          max={lastDay}
          error={fieldError("startsOn")}
          value={values.startsOn}
          onChange={(event) => update("startsOn", event.target.value)}
        />
        {values.duration === LineChangeDuration.Temporary ? (
          <TextField
            type="date"
            label={tForm("lineChange.endsOn")}
            required
            min={values.startsOn || today}
            max={lastDay}
            error={fieldError("endsOn")}
            value={values.endsOn}
            onChange={(event) => update("endsOn", event.target.value)}
          />
        ) : null}
      </div>
    </>
  );
}
