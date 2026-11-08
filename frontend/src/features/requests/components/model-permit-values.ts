import type { ModelPermitValues } from "../request-validation";
import { ModelPurpose } from "../schema";

/** A blank permit: the model comes in and goes out today until the student says otherwise. */
export function emptyModelPermit(today: string): ModelPermitValues {
  return {
    material: "",
    dimensions: "",
    purpose: "",
    purposeOther: "",
    destination: "",
    entryDate: today,
    entryTime: "",
    exitDate: today,
    exitTime: "",
    supervisorName: "",
    declarationAccepted: false,
  };
}

/** The request body for a checked form (validateModelPermit found nothing). */
export function toModelPermitBody(values: ModelPermitValues) {
  const purpose = values.purpose as ModelPurpose;
  return {
    material: values.material.trim(),
    dimensions: values.dimensions.trim(),
    purpose,
    purpose_other: purpose === ModelPurpose.Other ? values.purposeOther.trim() : null,
    destination: values.destination.trim(),
    entry_date: values.entryDate,
    entry_time: values.entryTime,
    exit_date: values.exitDate,
    exit_time: values.exitTime,
    supervisor_name: values.supervisorName.trim(),
    declaration_accepted: true as const,
  };
}
