"use client";

import { UserPlus, UsersRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SelectField } from "@/components/ui/select-field";
import { DataTable } from "@/components/ui/table";
import { Tone } from "@/components/ui/tone";
import { DeskListState } from "@/features/desk-kit/components/desk-list-state";
import { DeskSearch } from "@/features/desk-kit/components/desk-search";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { useAsync } from "@/lib/hooks/use-async";
import { listStaffUsers } from "../api";
import { STAFF_ROLES, type StaffRole, type StaffUsers } from "../schema";
import { AddUserDialog } from "./add-user-dialog";
import { UserActions } from "./user-actions";

/** The super admin's list of office accounts: add one, stop one, or move it to another office. */
export function UsersPage() {
  const t = useTranslations("desk.system.users");
  const tRoot = useTranslations();
  const locale = useLocale() as Locale;
  const [q, setQ] = useState("");
  const [role, setRole] = useState<StaffRole | "">("");
  const [adding, setAdding] = useState(false);
  const state = useAsync(
    (signal) => listStaffUsers({ q: q || undefined, role: role || undefined }, { signal }),
    [q, role],
  );
  const { refresh } = state;
  const onSearch = useCallback((value: string) => setQ(value), []);
  const counts = state.data?.counts ?? {};
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("lead")}
        actions={
          <Button iconStart={<UserPlus />} onClick={() => setAdding(true)}>
            {t("add")}
          </Button>
        }
      />
      <div className="flex flex-wrap items-end gap-3">
        <DeskSearch hint={t("searchHint")} onSearch={onSearch} />
        <SelectField
          label={t("office")}
          value={role}
          containerClassName="w-full max-w-xs"
          onChange={(event) => setRole(event.target.value as StaffRole | "")}
          options={[
            { value: "", label: t("allOffices", { count: formatNumber(total, locale) }) },
            ...STAFF_ROLES.map((value) => ({
              value,
              label: `${tRoot(`roles.${value}`)} (${formatNumber(counts[value] ?? 0, locale)})`,
            })),
          ]}
        />
      </div>
      <DeskListState state={state}>
        {(list: StaffUsers) => (
          <DataTable
            caption={t("caption")}
            rows={list.items}
            getRowKey={(user) => user.user_id}
            empty={
              <p className="flex items-center gap-2 text-body text-ink-muted">
                <UsersRound aria-hidden="true" className="size-5" />
                {t("empty")}
              </p>
            }
            columns={[
              {
                key: "name",
                header: t("name"),
                cell: (user) => (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-ink-strong">{user.name}</span>
                    {user.is_you ? <Badge tone={Tone.Brand}>{t("you")}</Badge> : null}
                  </span>
                ),
              },
              {
                key: "identifier",
                header: t("identifier"),
                cell: (user) => <bdi className="tabular-nums">{user.identifier}</bdi>,
              },
              {
                key: "office",
                header: t("office"),
                cell: (user) => tRoot(`roles.${user.role}`),
              },
              {
                key: "phone",
                header: t("phone"),
                cell: (user) => (
                  <bdi dir="ltr" className="tabular-nums">
                    {user.masked_phone}
                  </bdi>
                ),
              },
              {
                key: "status",
                header: t("status"),
                cell: (user) =>
                  user.active ? (
                    <Badge tone={Tone.Success}>{t("active")}</Badge>
                  ) : (
                    <Badge tone={Tone.Danger}>{t("stopped")}</Badge>
                  ),
              },
              {
                key: "actions",
                header: <span className="sr-only">{t("actions")}</span>,
                cell: (user) => <UserActions user={user} onChanged={refresh} />,
              },
            ]}
          />
        )}
      </DeskListState>
      <p className="text-caption text-ink-muted">{t("selfNote")}</p>
      {adding ? (
        <AddUserDialog
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}
