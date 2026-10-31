"use client";

import { type FormEvent, useState } from "react";
import { BadgeAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { useErrorMessage } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useMutation } from "@/lib/api/use-api";
import { reportViolation } from "../api";
import { NewViolation, ViolationType } from "../schema";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** The crew reports a student's violation; it goes to student affairs and security to decide. */
export function ViolationForm() {
  const t = useTranslations("crew.violation");
  const toast = useToast();
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState<ViolationType>(ViolationType.Smoking);
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [invalid, setInvalid] = useState<"id" | "text" | "photo" | null>(null);
  const report = useMutation(reportViolation);
  const error = useErrorMessage(report.error);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (photo && (!photo.type.startsWith("image/") || photo.size > MAX_PHOTO_BYTES)) return setInvalid("photo");
    const body = { student_id: studentId.trim(), type, description: description.trim(), photo: photo ? await toDataUrl(photo) : null };
    const parsed = NewViolation.safeParse(body);
    if (!parsed.success) return setInvalid(parsed.error.issues.some((issue) => issue.path[0] === "student_id") ? "id" : "text");
    setInvalid(null);
    if (await report.run(parsed.data)) {
      setStudentId("");
      setDescription("");
      setPhoto(null);
      toast(t("sent"));
    }
  }

  return (
    <Card>
      <CardTitle>{t("title")}</CardTitle>
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <Field label={t("studentId")} error={invalid === "id" ? t("invalidId") : undefined}>
          {(props) => <Input {...props} value={studentId} inputMode="numeric" maxLength={9} dir="ltr" className="num text-start" onChange={(event) => setStudentId(event.target.value.replace(/\D/g, ""))} />}
        </Field>
        <Field label={t("type")}>
          {(props) => (
            <Select {...props} value={type} onChange={(event) => setType(event.target.value as ViolationType)}>
              {Object.values(ViolationType).map((value) => (
                <option key={value} value={value}>
                  {t(`types.${value}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t("description")} error={invalid === "text" ? t("invalidText") : undefined}>
          {(props) => <Textarea {...props} value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} />}
        </Field>
        <Field label={t("photo")} hint={t("photoHint")} error={invalid === "photo" ? t("invalidPhoto") : undefined}>
          {(props) => <Input {...props} type="file" accept="image/*" capture="environment" className="py-2.5" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} />}
        </Field>
        {error && <Banner tone="danger">{error}</Banner>}
        <Button type="submit" variant="secondary" icon={<BadgeAlert className="size-4" aria-hidden />} loading={report.pending}>
          {t("send")}
        </Button>
      </form>
    </Card>
  );
}
