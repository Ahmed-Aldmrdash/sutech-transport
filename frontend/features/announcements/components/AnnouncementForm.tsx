"use client";

import { type FormEvent, useState } from "react";
import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { useErrorMessage } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { Line } from "@/features/lines/schema";
import { useMutation } from "@/lib/api/use-api";
import { cairoLocalToIso } from "@/lib/time";
import { createAnnouncement } from "../api";
import { ALL_LINES, AnnouncementKind, LINE_ALERT_KINDS, NewAnnouncement } from "../schema";

type Mode = "official" | "alert";
type AlertKind = (typeof LINE_ALERT_KINDS)[number];

/** Official announcements (can be pinned or scheduled) and line alerts (delay, bus or time change, cancelled trip). */
export function AnnouncementForm({ lines }: { lines: Line[] }) {
  const t = useTranslations("admin.announcements.form");
  const tk = useTranslations("announcements.kind");
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("official");
  const [alertKind, setAlertKind] = useState<AlertKind>(AnnouncementKind.Delay);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [target, setTarget] = useState<string>(ALL_LINES);
  const [minutes, setMinutes] = useState("15");
  const [pinned, setPinned] = useState(false);
  const [toParents, setToParents] = useState(true);
  const [schedule, setSchedule] = useState(false);
  const [publishAt, setPublishAt] = useState("");
  const [invalid, setInvalid] = useState(false);
  const create = useMutation(createAnnouncement);
  const error = useErrorMessage(create.error);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const official = mode === "official";
    const kind = official ? AnnouncementKind.Official : alertKind;
    const body = {
      kind,
      title: official ? title.trim() : null,
      text: text.trim(),
      target,
      delay_minutes: kind === AnnouncementKind.Delay ? Number(minutes) : null,
      pinned: official && pinned,
      to_parents: toParents,
      publish_at: official && schedule && publishAt ? cairoLocalToIso(publishAt) : null,
    };
    const parsed = NewAnnouncement.safeParse(body);
    if (!parsed.success || (official && schedule && !publishAt)) return setInvalid(true);
    setInvalid(false);
    if (await create.run(parsed.data)) {
      setTitle("");
      setText("");
      setPinned(false);
      setSchedule(false);
      setPublishAt("");
      toast(body.publish_at ? t("scheduled") : t("published"));
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Segmented
        label={t("mode")}
        value={mode}
        onChange={(value) => {
          setMode(value);
          setTarget(value === "official" ? ALL_LINES : (lines[0]?.id ?? ""));
        }}
        options={[
          { value: "official", label: t("official") },
          { value: "alert", label: t("alert") },
        ]}
      />
      {mode === "alert" && (
        <Field label={t("kind")}>
          {(props) => (
            <Select {...props} value={alertKind} onChange={(event) => setAlertKind(event.target.value as AlertKind)}>
              {LINE_ALERT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {tk(kind)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      <Field label={t("target")}>
        {(props) => (
          <Select {...props} value={target} onChange={(event) => setTarget(event.target.value)}>
            {mode === "official" && <option value={ALL_LINES}>{t("allLines")}</option>}
            {lines.map((line) => (
              <option key={line.id} value={line.id}>
                {line.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {mode === "official" && <Field label={t("title")}>{(props) => <Input {...props} value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} />}</Field>}
      {mode === "alert" && alertKind === AnnouncementKind.Delay && (
        <Field label={t("minutes")}>{(props) => <Input {...props} type="number" min={1} max={180} value={minutes} onChange={(event) => setMinutes(event.target.value)} />}</Field>
      )}
      <Field label={t("text")} error={invalid ? t("invalid") : undefined}>
        {(props) => <Textarea {...props} value={text} maxLength={1000} onChange={(event) => setText(event.target.value)} />}
      </Field>
      <div className="flex flex-wrap gap-x-6">
        <Checkbox label={t("toParents")} checked={toParents} onChange={(event) => setToParents(event.target.checked)} />
        {mode === "official" && <Checkbox label={t("pin")} checked={pinned} onChange={(event) => setPinned(event.target.checked)} />}
        {mode === "official" && <Checkbox label={t("schedule")} checked={schedule} onChange={(event) => setSchedule(event.target.checked)} />}
      </div>
      {mode === "official" && schedule && (
        <Field label={t("publishAt")} hint={t("publishAtHint")}>
          {(props) => <Input {...props} type="datetime-local" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} />}
        </Field>
      )}
      {error && <Banner tone="danger">{error}</Banner>}
      <Button type="submit" icon={<Send className="flip-rtl size-4" aria-hidden />} loading={create.pending}>
        {schedule && mode === "official" ? t("scheduleButton") : t("publish")}
      </Button>
    </form>
  );
}
