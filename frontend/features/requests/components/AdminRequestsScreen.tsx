"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { useCanEdit } from "@/components/layout/RequirePage";
import { useMe } from "@/components/providers/SessionProvider";
import { Async } from "@/components/ui/Async";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Textarea } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState, useErrorMessage } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { Role } from "@/features/auth/roles";
import { useApi, useMutation } from "@/lib/api/use-api";
import { adminDecide, listAdminRequests } from "../api";
import type { StudentRequest } from "../schema";
import { RequestCard } from "./RequestCard";

/** The step this role decides: transport office or finance; the super admin can act on either. */
function myTurn(request: StudentRequest, role: string): boolean {
  const current = request.steps.find((step) => step.state === "current");
  if (request.status !== "open" || !current || current.actor === "parent") return false;
  if (role === Role.SuperAdmin) return true;
  return (current.actor === "transport" && role === Role.TransportAdmin) || (current.actor === "finance" && role === Role.Finance);
}

export function AdminRequestsScreen() {
  const t = useTranslations("admin.requests");
  const toast = useToast();
  const me = useMe();
  const canEdit = useCanEdit();
  const query = useApi(listAdminRequests);
  const decide = useMutation(adminDecide);
  const error = useErrorMessage(decide.error);
  const [filter, setFilter] = useState<"mine" | "open" | "all">("mine");
  const [rejecting, setRejecting] = useState<StudentRequest | null>(null);
  const [reason, setReason] = useState("");

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="mb-4 max-w-md">
        <Segmented label={t("filter")} value={filter} onChange={setFilter} options={[{ value: "mine", label: t("mine") }, { value: "open", label: t("open") }, { value: "all", label: t("all") }]} />
      </div>
      {error && <Banner tone="danger" className="mb-3">{error}</Banner>}
      <Async query={query}>
        {(data) => {
          const items = data.items.filter((item) => (filter === "mine" ? myTurn(item, me.role) : filter === "open" ? item.status === "open" : true));
          if (!items.length) return <EmptyState title={t("empty")} />;
          return (
            <div className="grid gap-3 lg:grid-cols-2">
              {items.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  showStudent
                  actions={
                    canEdit &&
                    myTurn(request, me.role) && (
                      <span className="flex gap-2">
                        <Button size="sm" variant="dangerGhost" onClick={() => setRejecting(request)}>
                          {t("reject")}
                        </Button>
                        <Button size="sm" loading={decide.pending} onClick={async () => (await decide.run(request.id, true)) && toast(t("approved"))}>
                          {t("approve")}
                        </Button>
                      </span>
                    )
                  }
                />
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
        confirmDisabled={reason.trim().length < 3}
        onClose={() => setRejecting(null)}
        onConfirm={async () => {
          if (rejecting && reason.trim().length >= 3 && (await decide.run(rejecting.id, false, reason.trim()))) {
            setRejecting(null);
            setReason("");
            toast(t("rejected"));
          }
        }}
      >
        <Field label={t("reason")} hint={t("reasonHint")}>{(props) => <Textarea {...props} value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} />}</Field>
      </ConfirmDialog>
    </>
  );
}
