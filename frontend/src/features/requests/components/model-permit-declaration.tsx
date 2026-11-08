"use client";

import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/choice";
import { MODEL_PERMIT_PLEDGES } from "../schema";
import { type FieldsProps } from "./model-permit-fields";

/** The student's pledge, as on the paper permit. */
export function Declaration({
  values,
  update,
  fieldError,
  name,
  identifier,
}: FieldsProps & { name: string; identifier: string }) {
  const tPermit = useTranslations("student.requests.modelPermit");
  return (
    <div className="flex flex-col gap-3 rounded-md bg-surface-alt p-4">
      <p className="text-body-sm font-bold text-ink-strong">{tPermit("declarationTitle")}</p>
      <p className="text-body-sm text-ink">
        {tPermit("declarationIntro", {
          name: name,
          id: identifier,
        })}
      </p>
      <ul className="flex list-disc flex-col gap-1 ps-5 text-body-sm text-ink">
        {MODEL_PERMIT_PLEDGES.map((pledge) => (
          <li key={pledge}>{tPermit(`pledges.${pledge}`)}</li>
        ))}
      </ul>
      <p className="text-body-sm text-ink">{tPermit("declarationOutro")}</p>
      <div className="flex flex-col gap-1">
        <Checkbox
          label={tPermit("declarationAccept")}
          checked={values.declarationAccepted}
          aria-invalid={fieldError("declarationAccepted") ? true : undefined}
          onChange={(event) => update("declarationAccepted", event.target.checked)}
        />
        {fieldError("declarationAccepted") ? (
          <p role="alert" className="text-body-sm text-danger-text">
            {fieldError("declarationAccepted")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
