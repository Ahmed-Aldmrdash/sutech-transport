"use client";

import { Camera, FileCheck2, ShieldAlert, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { SelectField, TextAreaField } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tone } from "@/components/ui/tone";
import { useToast } from "@/components/ui/toast";
import { CrewGate } from "@/features/crew/components/crew-gate";
import type { CrewToday } from "@/features/crew/schema";
import { currentTrip } from "@/features/crew/trip-rules";
import { readFileAsBase64 } from "@/features/payments/receipt-validation";
import type { Locale } from "@/i18n/routing";
import { formatDateTime, formatFileSize, formatNumber } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { useSubmit } from "@/lib/hooks/use-submit";
import { createViolation, listMyViolations } from "../api";
import {
  CONDUCT_RULES,
  CONDUCT_RULE_NUMBER,
  VIOLATION_DESCRIPTION_MAX_LENGTH,
  VIOLATION_DESCRIPTION_MIN_LENGTH,
  VIOLATION_PHOTO_MAX_BYTES,
  VIOLATION_PHOTO_TYPES,
  ViolationErrorCode,
  ViolationStatus,
  type ConductRule,
  type Violation,
} from "../schema";
import { focusFirstError } from "@/lib/forms/focus-first-error";

const SERVER_ERRORS = Object.values(ViolationErrorCode);
const STATUS_TONE: Record<Violation["status"], Tone> = {
  [ViolationStatus.Submitted]: Tone.Info,
  [ViolationStatus.UnderReview]: Tone.Warning,
  [ViolationStatus.Closed]: Tone.Neutral,
};

type FormErrors = Partial<Record<"rule" | "description" | "photo", string>>;

/** A breach of the bus Code of Conduct, with a photo, for Student Affairs and Transport. */
export function ViolationsPage() {
  const t = useTranslations("violations");
  const mine = useAsync((signal) => listMyViolations({ signal }), []);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("lead")} />
      <CrewGate>
        {(today) => (
          <div className="grid items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <ViolationForm today={today} onSent={mine.refresh} />
            <Card>
              <CardHeader title={t("mineTitle")} headingLevel={2} />
              <CardBody>
                {mine.status === AsyncStatus.Loading ? <Skeleton className="h-32 w-full" /> : null}
                {mine.status === AsyncStatus.Error ? (
                  <ErrorState error={mine.error} onRetry={mine.reload} />
                ) : null}
                {mine.status === AsyncStatus.Success ? <MyList items={mine.data.items} /> : null}
              </CardBody>
            </Card>
          </div>
        )}
      </CrewGate>
    </div>
  );
}

function ViolationForm({ today, onSent }: { today: CrewToday; onSent: () => void }) {
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
  const photoRef = useRef<HTMLInputElement>(null);

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
          <Field label={t("photo")} hint={t("photoHint")} required error={errors.photo}>
            {(control) => (
              <div className="flex flex-col gap-2 rounded-md border border-dashed border-line-strong p-3">
                <input
                  ref={photoRef}
                  {...control}
                  type="file"
                  accept={VIOLATION_PHOTO_TYPES.join(",")}
                  capture="environment"
                  className="sr-only"
                  onChange={(event) => {
                    setPhoto(event.target.files?.[0] ?? null);
                    event.target.value = "";
                  }}
                />
                {photo ? (
                  <p className="flex min-w-0 items-center gap-2 text-body-sm text-ink-strong">
                    <FileCheck2 aria-hidden="true" className="size-5 shrink-0 text-success" />
                    <span className="truncate" dir="ltr">
                      {photo.name}
                    </span>
                    <span className="shrink-0 text-ink-muted">
                      ({formatFileSize(photo.size, locale)})
                    </span>
                    <IconButton
                      size="sm"
                      variant="ghost"
                      className="ms-auto"
                      icon={<X />}
                      label={t("removePhoto")}
                      onClick={() => setPhoto(null)}
                    />
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="self-start"
                  iconStart={<Camera className="size-4" />}
                  onClick={() => photoRef.current?.click()}
                >
                  {photo ? t("retakePhoto") : t("takePhoto")}
                </Button>
              </div>
            )}
          </Field>
          {serverError ? <Alert tone={Tone.Danger} title={t(`errors.${serverError}`)} /> : null}
          <Button type="submit" withArrow isLoading={isSending} className="self-start">
            {t("submit")}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function MyList({ items }: { items: Violation[] }) {
  const t = useTranslations("violations");
  const locale = useLocale() as Locale;
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 text-body-sm text-ink-muted">
        <ShieldAlert aria-hidden="true" className="size-5 shrink-0" />
        {t("mineEmpty")}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li
          key={item.violation_id}
          className="flex flex-col gap-1 rounded-md border border-line p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-body-sm font-bold text-ink-strong">{t(`rules.${item.rule}`)}</p>
            <Badge tone={STATUS_TONE[item.status]}>{t(`status.${item.status}`)}</Badge>
          </div>
          <p className="text-caption text-ink-muted">
            {item.student ? `${item.student.name} · ` : ""}
            {formatDateTime(item.created_at, locale)}
          </p>
          <p className="text-body-sm text-ink">{item.description}</p>
        </li>
      ))}
    </ul>
  );
}
