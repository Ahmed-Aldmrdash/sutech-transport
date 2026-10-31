"use client";

import { type FormEvent, useState } from "react";
import { UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { useMe } from "@/components/providers/SessionProvider";
import { Async } from "@/components/ui/Async";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { useErrorMessage } from "@/components/ui/States";
import { Switch } from "@/components/ui/Switch";
import { type Column, Table } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { ADMIN_ROLES, CREW_ROLES, type Role } from "@/features/auth/roles";
import { useApi, useMutation } from "@/lib/api/use-api";
import { createUser, listUsers, updateUser } from "../api";
import { type AdminUser, NewUser } from "../schema";

/** Staff accounts and their roles. Students and parents come from student affairs, not from here. */
const STAFF_ROLES: readonly Role[] = [...ADMIN_ROLES, ...CREW_ROLES];

export function UsersScreen() {
  const t = useTranslations("admin.users");
  const tr = useTranslations("roles");
  const me = useMe();
  const toast = useToast();
  const query = useApi(listUsers);
  const update = useMutation(updateUser);
  const error = useErrorMessage(update.error);

  const columns: Column<AdminUser>[] = [
    { key: "name", header: t("name"), cell: (row) => <span className="font-bold text-ink-strong">{row.name}{row.id === me.id && <span className="ms-1 text-[12px] text-ink-muted">({t("you")})</span>}</span> },
    {
      key: "role",
      header: t("role"),
      cell: (row) => (
        <select
          aria-label={t("roleOf", { name: row.name })}
          value={row.role}
          disabled={update.pending}
          onChange={async (event) => (await update.run(row.id, { role: event.target.value })) && toast(t("saved"))}
          className="min-h-10 rounded-md border border-line-strong bg-surface-raised px-2"
        >
          {STAFF_ROLES.map((role) => (
            <option key={role} value={role}>
              {tr(role)}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: "active",
      header: t("active"),
      cell: (row) => (
        <div className="w-40">
          <Switch checked={row.active} disabled={update.pending} label={row.active ? t("on") : t("off")} onChange={async (active) => (await update.run(row.id, { active })) && toast(t("saved"))} />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
        <Card className="self-start">
          <CardTitle>{t("new")}</CardTitle>
          <NewUserForm />
        </Card>
        <div className="flex flex-col gap-3">
          {error && <Banner tone="danger">{error}</Banner>}
          <Async query={query}>{(users) => <Table rows={users} columns={columns} rowKey={(row) => row.id} caption={t("title")} empty={t("empty")} />}</Async>
        </div>
      </div>
    </>
  );
}

function NewUserForm() {
  const t = useTranslations("admin.users");
  const tr = useTranslations("roles");
  const toast = useToast();
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>(STAFF_ROLES[1]!);
  const [invalid, setInvalid] = useState(false);
  const create = useMutation(createUser);
  const error = useErrorMessage(create.error);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!NewUser.safeParse({ name: name.trim(), role }).success) return setInvalid(true);
    setInvalid(false);
    if (await create.run(name.trim(), role)) {
      setName("");
      toast(t("created"));
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <Field label={t("name")} error={invalid ? t("invalid") : undefined}>{(props) => <Input {...props} value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />}</Field>
      <Field label={t("role")}>
        {(props) => (
          <Select {...props} value={role} onChange={(event) => setRole(event.target.value as Role)}>
            {STAFF_ROLES.map((value) => (
              <option key={value} value={value}>
                {tr(value)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {error && <Banner tone="danger">{error}</Banner>}
      <Button type="submit" icon={<UserPlus className="size-4" aria-hidden />} loading={create.pending}>
        {t("create")}
      </Button>
    </form>
  );
}
