"use client";

import { type FormEvent, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Async } from "@/components/ui/Async";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Select, Textarea } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { EmptyState, useErrorMessage } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useApi, useMutation } from "@/lib/api/use-api";
import { formatDateTime } from "@/lib/time";
import { fileComplaint, listMyComplaints } from "../api";
import { ComplaintCategory, NewComplaint } from "../schema";

export function ComplaintsScreen() {
  const t = useTranslations("complaints");
  const locale = useLocale();
  const toast = useToast();
  const query = useApi(listMyComplaints);
  const file = useMutation(fileComplaint);
  const error = useErrorMessage(file.error);
  const [category, setCategory] = useState<ComplaintCategory>(ComplaintCategory.Delay);
  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!NewComplaint.safeParse({ category, text }).success) return setInvalid(true);
    setInvalid(false);
    if (await file.run(category, text.trim())) {
      setText("");
      toast(t("sent"));
    }
  }

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="flex flex-col gap-4">
        <Card>
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <Field label={t("category")}>
              {(props) => (
                <Select {...props} value={category} onChange={(event) => setCategory(event.target.value as ComplaintCategory)}>
                  {Object.values(ComplaintCategory).map((value) => (
                    <option key={value} value={value}>
                      {t(`categories.${value}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t("text")} hint={t("textHint")} error={invalid ? t("tooShort") : undefined}>
              {(props) => <Textarea {...props} value={text} maxLength={1000} onChange={(event) => setText(event.target.value)} />}
            </Field>
            {error && <Banner tone="danger">{error}</Banner>}
            <Button type="submit" icon={<MessageSquarePlus className="size-4" aria-hidden />} loading={file.pending}>
              {t("submit")}
            </Button>
          </form>
        </Card>
        <h2 className="text-[18px] font-bold">{t("mine")}</h2>
        <Async query={query}>
          {(data) =>
            data.items.length === 0 ? (
              <EmptyState title={t("empty")} />
            ) : (
              <div className="flex flex-col gap-3">
                {data.items.map((item) => (
                  <Card as="article" key={item.id} className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Pill>{t(`categories.${item.category}`)}</Pill>
                      <Pill tone={item.status === "answered" ? "success" : "warning"}>{t(`status.${item.status}`)}</Pill>
                    </div>
                    <p className="whitespace-pre-line">{item.text}</p>
                    {item.reply && (
                      <div className="rounded-md border-s-4 border-teal bg-teal-soft p-3 text-[15px] text-teal-text">
                        <p className="font-bold">{t("reply")}</p>
                        <p className="whitespace-pre-line">{item.reply}</p>
                      </div>
                    )}
                    <time dateTime={item.created_at} className="text-[13px] text-ink-muted">
                      {formatDateTime(item.created_at, locale)}
                    </time>
                  </Card>
                ))}
              </div>
            )
          }
        </Async>
      </div>
    </>
  );
}
