"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Async } from "@/components/ui/Async";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Textarea } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState, useErrorMessage } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useApi, useMutation } from "@/lib/api/use-api";
import { formatDateTime } from "@/lib/time";
import { listAllComplaints, replyToComplaint } from "../api";
import type { Complaint } from "../schema";

/** All complaints, unanswered first. `readOnly` for the secretary general's office. */
export function AdminComplaintsScreen({ readOnly = false, embedded = false }: { readOnly?: boolean; embedded?: boolean }) {
  const t = useTranslations("admin.complaints");
  const query = useApi(listAllComplaints);
  const [filter, setFilter] = useState<"new" | "all">("new");
  return (
    <>
      {!embedded && <PageHeader title={t("title")} subtitle={t("subtitle")} />}
      <div className="mb-4 max-w-sm">
        <Segmented label={t("filter")} value={filter} onChange={setFilter} options={[{ value: "new", label: t("unanswered") }, { value: "all", label: t("all") }]} />
      </div>
      <Async query={query}>
        {(data) => {
          const items = filter === "new" ? data.items.filter((item) => item.status === "new") : data.items;
          if (!items.length) return <EmptyState title={t("empty")} />;
          return (
            <div className="grid gap-3 lg:grid-cols-2">
              {items.map((item) => (
                <ComplaintCard key={item.id} item={item} readOnly={readOnly} />
              ))}
            </div>
          );
        }}
      </Async>
    </>
  );
}

function ComplaintCard({ item, readOnly }: { item: Complaint; readOnly: boolean }) {
  const t = useTranslations("admin.complaints");
  const tc = useTranslations("complaints");
  const locale = useLocale();
  const toast = useToast();
  const [reply, setReply] = useState("");
  const send = useMutation(replyToComplaint);
  const error = useErrorMessage(send.error);
  return (
    <Card as="article" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex gap-2">
          <Pill>{tc(`categories.${item.category}`)}</Pill>
          <Pill tone={item.status === "answered" ? "success" : "warning"}>{tc(`status.${item.status}`)}</Pill>
        </span>
        <time dateTime={item.created_at} className="text-[13px] text-ink-muted">
          {formatDateTime(item.created_at, locale)}
        </time>
      </div>
      <p className="font-bold text-ink-strong">
        {item.student_name} · <span className="num">{item.student_id}</span>
      </p>
      <p className="whitespace-pre-line">{item.text}</p>
      {item.reply && (
        <div className="rounded-md border-s-4 border-teal bg-teal-soft p-3 text-teal-text">
          <p className="font-bold">{tc("reply")}</p>
          <p className="whitespace-pre-line">{item.reply}</p>
        </div>
      )}
      {!readOnly && item.status === "new" && (
        <form
          className="flex flex-col gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (reply.trim().length >= 3 && (await send.run(item.id, reply.trim()))) {
              setReply("");
              toast(t("replied"));
            }
          }}
        >
          <Field label={t("reply")}>{(props) => <Textarea {...props} value={reply} maxLength={1000} onChange={(event) => setReply(event.target.value)} />}</Field>
          {error && <Banner tone="danger">{error}</Banner>}
          <Button type="submit" size="sm" className="self-end" disabled={reply.trim().length < 3} loading={send.pending}>
            {t("send")}
          </Button>
        </form>
      )}
    </Card>
  );
}
