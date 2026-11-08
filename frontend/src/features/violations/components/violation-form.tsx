"use client";

import { PhotoField } from "./photo-field";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { TextAreaField } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Tone } from "@/components/ui/tone";
import { useToast } from "@/components/ui/toast";
import type { CrewToday } from "@/features/crew/schema";
import { currentTrip } from "@/features/crew/trip-rules";
import { readFileAsBase64 } from "@/features/payments/receipt-validation";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { useSubmit } from "@/lib/hooks/use-submit";
import { createViolation } from "../api";
import {
  CONDUCT_RULES,
  CONDUCT_RULE_NUMBER,
  VIOLATION_DESCRIPTION_MAX_LENGTH,
  VIOLATION_DESCRIPTION_MIN_LENGTH,
  VIOLATION_PHOTO_MAX_BYTES,
  VIOLATION_PHOTO_TYPES,
  ViolationErrorCode,
  type ConductRule,
} from "../schema";
import { focusFirstError } from "@/lib/forms/focus-first-error";

const SERVER_ERRORS = Object.values(ViolationErrorCode);

type FormErrors = Partial<Record<"rule" | "description" | "photo", string>>;

export function ViolationForm({ today, onSent }: { today: CrewToday; onSent: () => void }) {
  const t = useTranslations("violations");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const toast = useToast();
  const trip = currentTrip(today);
  const [rule, setRule] = useState<ConductRule | "">("");
  const [student, setStudent] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const { submit, isSending, serverError } = useSubmit(SERVER_ERRORS);

  function validate(): FormErrors {
    const found: FormErrors = {};
    if (!rule) found.rule = t("errors.ruleRequired");
    if (description.trim().length < VIOLATION_DESCRIPTION_MIN_LENGTH) {
      found.description = t("errors.descriptionShort", {
        count: formatNumber(VIOLATION_DESCRIPTION_MIN_LENGTH, locale),
      });
    }
    if (!photo) found.photo = t("errors.photoRequired");
    else if (!(VIOLATION_PHOTO_TYPES as readonly string[]).includes(photo.type)) {
      found.photo = t("errors.FILE_TYPE");
    } else if (photo.size > VIOLATION_PHOTO_MAX_BYTES) found.photo = t("errors.FILE_TOO_LARGE");
    return found;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const form = event.currentTarget as HTMLElement;
    const found = validate();
    setErrors(found);
    focusFirstError(form);
    if (Object.keys(found).length > 0 || !rule || !photo) return;
    const sent = await submit(async (idempotencyKey) =>
      createViolation(
        {
          trip_id: trip?.trip_id ?? null,
          student_identifier: student || null,
          rule,
          description: description.trim(),
          photo: {
            file_name: photo.name,
            content_type: photo.type as (typeof VIOLATION_PHOTO_TYPES)[number],
            data_base64: await readFileAsBase64(photo),
          },
        },
        { idempotencyKey },
      ),
    );
    if (sent) {
      toast.show({ title: t("sentTitle"), description: t("sentBody"), tone: Tone.Success });
      setRule("");
      setStudent("");
      setDescription("");
      setPhoto(null);
      onSent();
    }
  }

  const ruleLabel = (value: ConductRule) => {
    const number = CONDUCT_RULE_NUMBER[value];
    const name = t(`rules.${value}`);
    return number === null
      ? name
      : t("ruleNumbered", { number: formatNumber(number, locale), name });
  };

  return (
    <Card elevation="raised">
      <CardBody>
        <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-5">
          <SelectField
            label={t("rule")}
            required
            placeholder={t("rulePlaceholder")}
            value={rule}
            error={errors.rule}
            options={CONDUCT_RULES.map((value) => ({ value, label: ruleLabel(value) }))}
            onChange={(event) => setRule(event.target.value as ConductRule | "")}
          />
          <SelectField
            label={t("student")}
            hint={t("studentHint")}
            optionalText={tCommon("optional")}
            placeholder={t("studentUnknown")}
            value={student}
            options={(trip?.riders ?? []).map((rider) => ({
              value: rider.identifier,
              label: `${rider.name} · ${rider.identifier}`,
            }))}
            onChange={(event) => setStudent(event.target.value)}
          />
          <TextAreaField
            label={t("description")}
            hint={t("descriptionHint")}
            required
            maxLength={VIOLATION_DESCRIPTION_MAX_LENGTH}
            value={description}
            error={errors.description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <PhotoField photo={photo} error={errors.photo} onChange={setPhoto} />
          {serverError ? <Alert tone={Tone.Danger} title={t(`errors.${serverError}`)} /> : null}
          <Button type="submit" withArrow isLoading={isSending} className="self-start">
            {t("submit")}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
