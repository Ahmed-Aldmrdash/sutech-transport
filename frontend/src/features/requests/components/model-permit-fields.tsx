"use client";

import { useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";
import { Radio } from "@/components/ui/choice";
import { TextField } from "@/components/ui/input";
import type { ModelPermitField, ModelPermitValues } from "../request-validation";
import { MODEL_PURPOSES, ModelPurpose } from "../schema";

/** What each part of the permit form gets from the form: the values and how to change them. */
export interface FieldsProps {
  values: ModelPermitValues;
  update: <K extends ModelPermitField>(key: K, value: ModelPermitValues[K]) => void;
  fieldError: (key: ModelPermitField) => string | undefined;
}

/** A titled box inside the form, like the sections of the paper permit. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <div role="group" aria-labelledby={titleId} className="flex flex-col gap-4">
      <p id={titleId} className="text-body font-bold text-ink-strong">
        {title}
      </p>
      {children}
    </div>
  );
}

/** The model itself and why it's going to campus. */
export function ModelFields({ values, update, fieldError }: FieldsProps) {
  const tPermit = useTranslations("student.requests.modelPermit");
  return (
    <>
      <Section title={tPermit("modelTitle")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={tPermit("material")}
            hint={tPermit("materialHint")}
            required
            autoComplete="off"
            error={fieldError("material")}
            value={values.material}
            onChange={(event) => update("material", event.target.value)}
          />
          <TextField
            label={tPermit("dimensions")}
            hint={tPermit("dimensionsHint")}
            required
            autoComplete="off"
            error={fieldError("dimensions")}
            value={values.dimensions}
            onChange={(event) => update("dimensions", event.target.value)}
          />
        </div>
      </Section>

      <Section title={tPermit("purposeTitle")}>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-body-sm font-bold text-ink-strong">
            {tPermit("purpose")}
          </legend>
          <div className="flex flex-wrap gap-x-6">
            {MODEL_PURPOSES.map((purpose) => (
              <Radio
                key={purpose}
                name="purpose"
                value={purpose}
                label={tPermit(`purposes.${purpose}`)}
                checked={values.purpose === purpose}
                aria-invalid={fieldError("purpose") ? true : undefined}
                onChange={() => update("purpose", purpose)}
              />
            ))}
          </div>
          {fieldError("purpose") ? (
            <p role="alert" className="text-body-sm text-danger-text">
              {fieldError("purpose")}
            </p>
          ) : null}
        </fieldset>
        {values.purpose === ModelPurpose.Other ? (
          <TextField
            label={tPermit("purposeOther")}
            required
            autoComplete="off"
            containerClassName="sm:max-w-sm"
            error={fieldError("purposeOther")}
            value={values.purposeOther}
            onChange={(event) => update("purposeOther", event.target.value)}
          />
        ) : null}
        <TextField
          label={tPermit("destination")}
          hint={tPermit("destinationHint")}
          required
          autoComplete="off"
          error={fieldError("destination")}
          value={values.destination}
          onChange={(event) => update("destination", event.target.value)}
        />
      </Section>
    </>
  );
}
