"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Async } from "@/components/ui/Async";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Textarea } from "@/components/ui/Field";
import { EmptyState, useErrorMessage } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { parentDecide } from "@/features/requests/api";
import { RequestCard } from "@/features/requests/components/RequestCard";
import type { StudentRequest } from "@/features/requests/schema";
import { useApi, useMutation } from "@/lib/api/use-api";
import { listChildrenRequests } from "../api";

const waitsForParent = (request: StudentRequest) => request.status === "open" && request.steps.some((step) => step.actor === "parent" && step.state === "current");

/** Refunds and line changes start with the parent's approval. */
export function ApprovalsScreen() {
  const t = useTranslations("parent.approvals");
  const toast = useToast();
  const query = useApi(listChildrenRequests);
  const decide = useMutation(parentDecide);
  const error = useErrorMessage(decide.error);
  const [rejecting, setRejecting] = useState<StudentRequest | null>(null);
  const [reason, setReason] = useState("");

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Async query={query}>
        {(data) => {
          const waiting = data.items.filter(waitsForParent);
          const rest = data.items.filter((item) => !waitsForParent(item));
          return (
            <div className="flex flex-col gap-3">
              {error && <Banner tone="danger">{error}</Banner>}
              {waiting.length === 0 && <EmptyState title={t("nothingWaiting")} />}
              {waiting.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  showStudent
                  actions={
                    <div className="flex gap-2">
                      <Button size="sm" variant="dangerGhost" onClick={() => setRejecting(request)}>
                        {t("reject")}
                      </Button>
                      <Button size="sm" loading={decide.pending} onClick={async () => (await decide.run(request.id, true)) && toast(t("approved"))}>
                        {t("approve")}
                      </Button>
                    </div>
                  }
                />
              ))}
              {rest.length > 0 && <h2 className="mt-4 text-[18px] font-bold">{t("history")}</h2>}
              {rest.map((request) => (
                <RequestCard key={request.id} request={request} showStudent />
              ))}
            </div>
          );
        }}
      </Async>
      <ConfirmDialog
        open={!!rejecting}
        danger
        title={t("rejectTitle")}
        confirmLabel={t("reject")}
        pending={decide.pending}
        error={error || undefined}
        onClose={() => setRejecting(null)}
        onConfirm={async () => {
          if (rejecting && (await decide.run(rejecting.id, false, reason.trim() || null))) {
            setRejecting(null);
            setReason("");
            toast(t("rejected"));
          }
        }}
      >
        <Field label={t("reason")}>{(props) => <Textarea {...props} value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} />}</Field>
      </ConfirmDialog>
    </>
  );
}
