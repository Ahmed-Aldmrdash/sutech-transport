"use client";

import { Megaphone, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Radio } from "@/components/ui/choice";
import { EmptyState } from "@/components/ui/empty-state";
import { TextAreaField, TextField } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { SelectField } from "@/components/ui/select-field";
import { useToast } from "@/components/ui/toast";
import { Tone } from "@/components/ui/tone";
import { DeskListState } from "@/features/desk-kit/components/desk-list-state";
import { DeskPager } from "@/features/desk-kit/components/desk-pager";
import { listLines } from "@/features/lines/api";
import { focusFirstError } from "@/lib/forms/focus-first-error";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { useSubmit } from "@/lib/hooks/use-submit";
import { createAnnouncement, listAnnouncements } from "../api";
import {
  ANNOUNCEMENT_BODY_MAX_LENGTH,
  ANNOUNCEMENT_BODY_MIN_LENGTH,
  ANNOUNCEMENT_TITLE_MAX_LENGTH,
  ANNOUNCEMENT_TITLE_MIN_LENGTH,
  AnnouncementKind,
  OFFICE_ANNOUNCEMENT_KINDS,
  type AnnouncementPage,
} from "../schema";
import { AnnouncementItem } from "./announcement-item";

const PAGE_SIZE = 10;
const EVERYONE = "";

type FieldKey = "title_ar" | "title_en" | "body_ar" | "body_en";
type OfficeKind = (typeof OFFICE_ANNOUNCEMENT_KINDS)[number];

/** The Transportation office posts news in Arabic and English; each reader gets their own. */
export function OfficeAnnouncementsPage() {
  const t = useTranslations("desk.announcements");
  const [page, setPage] = useState(1);
  const state = useAsync(
    (signal) => listAnnouncements({ page, page_size: PAGE_SIZE }, { signal }),
    [page],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("lead")} />
      <div className="grid grid-cols-1 items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Composer
          onPosted={() => {
            setPage(1);
            state.refresh();
          }}
        />
        <Card>
          <CardHeader title={t("posted")} headingLevel={2} />
          <CardBody className="flex flex-col gap-4">
            <DeskListState state={state}>
              {(data: AnnouncementPage) =>
                data.items.length === 0 ? (
                  <EmptyState icon={<Megaphone />} title={t("empty")} />
                ) : (
                  <>
                    <ul className="flex flex-col divide-y divide-line">
                      {data.items.map((item) => (
                        <li key={item.announcement_id} className="py-4 first:pt-0 last:pb-0">
                          <AnnouncementItem item={item} withTime />
                        </li>
                      ))}
                    </ul>
                    <DeskPager
                      page={page}
                      pageSize={PAGE_SIZE}
                      total={data.total}
                      onPage={setPage}
                    />
                  </>
                )
              }
            </DeskListState>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

const EMPTY_TEXT: Record<FieldKey, string> = {
  title_ar: "",
  title_en: "",
  body_ar: "",
  body_en: "",
};

function Composer({ onPosted }: { onPosted: () => void }) {
  const t = useTranslations("desk.announcements.form");
  const tErrors = useTranslations("desk.announcements.errors");
  const toast = useToast();
  const lines = useAsync((signal) => listLines({ signal }), []);
  const [kind, setKind] = useState<OfficeKind>(AnnouncementKind.Official);
  const [lineId, setLineId] = useState(EVERYONE);
  const [text, setText] = useState(EMPTY_TEXT);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const { submit, isSending, serverError } = useSubmit<never>([]);

  function update(key: FieldKey, value: string) {
    setText((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function post(event: FormEvent) {
    event.preventDefault();
    const next: Partial<Record<FieldKey, string>> = {};
    for (const key of ["title_ar", "title_en"] as const) {
      if (text[key].trim().length < ANNOUNCEMENT_TITLE_MIN_LENGTH) next[key] = t("titleShort");
    }
    for (const key of ["body_ar", "body_en"] as const) {
      if (text[key].trim().length < ANNOUNCEMENT_BODY_MIN_LENGTH) next[key] = t("bodyShort");
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      focusFirstError(formRef.current);
      return;
    }
    const done = await submit(() =>
      createAnnouncement({
        kind,
        line_id: lineId === EVERYONE ? null : lineId,
        title_ar: text.title_ar.trim(),
        title_en: text.title_en.trim(),
        body_ar: text.body_ar.trim(),
        body_en: text.body_en.trim(),
      }),
    );
    if (!done) return;
    toast.show({ title: t("posted"), tone: Tone.Success });
    setText(EMPTY_TEXT);
    onPosted();
  }

  return (
    <Card elevation="raised">
      <CardHeader title={t("title")} headingLevel={2} />
      <CardBody>
        <form
          ref={formRef}
          noValidate
          onSubmit={(event) => void post(event)}
          className="flex flex-col gap-5"
        >
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-label text-ink-strong">{t("kind")}</legend>
            {OFFICE_ANNOUNCEMENT_KINDS.map((value) => (
              <Radio
                key={value}
                name="announcement-kind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
                label={t(`kinds.${value}.label`)}
                description={t(`kinds.${value}.hint`)}
              />
            ))}
          </fieldset>
          <SelectField
            label={t("audience")}
            hint={t("audienceHint")}
            value={lineId}
            disabled={lines.status !== AsyncStatus.Success}
            options={[
              { value: EVERYONE, label: t("everyone") },
              ...(lines.data ?? []).map((line) => ({
                value: line.line_id,
                label: t("lineOption", { code: line.code, name: line.name }),
              })),
            ]}
            onChange={(event) => setLineId(event.target.value)}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label={t("titleAr")}
              lang="ar"
              dir="rtl"
              required
              maxLength={ANNOUNCEMENT_TITLE_MAX_LENGTH}
              value={text.title_ar}
              error={errors.title_ar}
              onChange={(event) => update("title_ar", event.target.value)}
            />
            <TextField
              label={t("titleEn")}
              lang="en"
              dir="ltr"
              required
              maxLength={ANNOUNCEMENT_TITLE_MAX_LENGTH}
              value={text.title_en}
              error={errors.title_en}
              onChange={(event) => update("title_en", event.target.value)}
            />
            <TextAreaField
              label={t("bodyAr")}
              lang="ar"
              dir="rtl"
              required
              rows={5}
              maxLength={ANNOUNCEMENT_BODY_MAX_LENGTH}
              value={text.body_ar}
              error={errors.body_ar}
              onChange={(event) => update("body_ar", event.target.value)}
            />
            <TextAreaField
              label={t("bodyEn")}
              lang="en"
              dir="ltr"
              required
              rows={5}
              maxLength={ANNOUNCEMENT_BODY_MAX_LENGTH}
              value={text.body_en}
              error={errors.body_en}
              onChange={(event) => update("body_en", event.target.value)}
            />
          </div>
          <p className="text-caption text-ink-muted">{t("note")}</p>
          {serverError ? <Alert tone={Tone.Danger} title={tErrors(serverError)} /> : null}
          <Button type="submit" iconStart={<Send />} isLoading={isSending} className="self-start">
            {t("submit")}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
