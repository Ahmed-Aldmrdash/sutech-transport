"use client";

import { type FormEvent, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { useCanEdit } from "@/components/layout/RequirePage";
import { Async } from "@/components/ui/Async";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { useErrorMessage } from "@/components/ui/States";
import { type Column, Table } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useApi, useMutation } from "@/lib/api/use-api";
import { createBus, listBuses, updateBus } from "../api";
import { type Bus, BusInput } from "../schema";

const EMPTY: BusInput = { plate: "", type: "", capacity: 28, operator: "university", driver_name: null, status: "ok" };

export function AdminBusesScreen() {
  const t = useTranslations("admin.buses");
  const canEdit = useCanEdit();
  const query = useApi(listBuses);
  const [editing, setEditing] = useState<Bus | "new" | null>(null);
  const columns: Column<Bus>[] = [
    { key: "plate", header: t("plate"), cell: (bus) => <bdi className="font-bold text-ink-strong">{bus.plate}</bdi> },
    { key: "type", header: t("type"), cell: (bus) => bus.type },
    { key: "capacity", header: t("capacity"), cell: (bus) => <span className="num">{bus.capacity}</span> },
    { key: "operator", header: t("operator"), cell: (bus) => t(`operators.${bus.operator}`) },
    { key: "driver", header: t("driver"), cell: (bus) => bus.driver_name ?? <span className="text-ink-muted">{t("noDriver")}</span> },
    { key: "line", header: t("line"), cell: (bus) => bus.line_name ?? <span className="text-ink-muted">{t("free")}</span> },
    { key: "status", header: t("status"), cell: (bus) => <Pill tone={bus.status === "ok" ? "success" : "warning"}>{t(`statuses.${bus.status}`)}</Pill> },
    {
      key: "edit",
      header: <span className="sr-only">{t("edit")}</span>,
      cell: (bus) =>
        canEdit && (
          <Button size="sm" variant="ghost" icon={<Pencil className="size-4" aria-hidden />} onClick={() => setEditing(bus)}>
            {t("edit")}
          </Button>
        ),
    },
  ];
  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={canEdit && <Button size="sm" icon={<Plus className="size-4" aria-hidden />} onClick={() => setEditing("new")}>{t("add")}</Button>}
      />
      <Async query={query}>{(buses) => <Table rows={buses} columns={columns} rowKey={(bus) => bus.id} caption={t("title")} empty={t("empty")} />}</Async>
      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? t("add") : t("edit")}>
        {editing && <BusForm bus={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Dialog>
    </>
  );
}

function BusForm({ bus, onDone }: { bus: Bus | null; onDone: () => void }) {
  const t = useTranslations("admin.buses");
  const toast = useToast();
  const [value, setValue] = useState<BusInput>(bus ? { plate: bus.plate, type: bus.type, capacity: bus.capacity, operator: bus.operator, driver_name: bus.driver_name, status: bus.status } : EMPTY);
  const [invalid, setInvalid] = useState(false);
  const save = useMutation((input: BusInput) => (bus ? updateBus(bus.id, input) : createBus(input)));
  const error = useErrorMessage(save.error);
  const set = <K extends keyof BusInput>(key: K, next: BusInput[K]) => setValue((current) => ({ ...current, [key]: next }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = BusInput.safeParse({ ...value, driver_name: value.driver_name?.trim() || null });
    if (!parsed.success) return setInvalid(true);
    setInvalid(false);
    if (await save.run(parsed.data)) {
      toast(t("saved"));
      onDone();
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      {bus?.line_name && <Banner tone="info">{t("lineNotice", { line: bus.line_name })}</Banner>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("plate")}>{(props) => <Input {...props} value={value.plate} onChange={(event) => set("plate", event.target.value)} />}</Field>
        <Field label={t("type")}>{(props) => <Input {...props} value={value.type} onChange={(event) => set("type", event.target.value)} />}</Field>
        <Field label={t("capacity")}>{(props) => <Input {...props} type="number" min={8} max={80} value={value.capacity} onChange={(event) => set("capacity", Number(event.target.value))} />}</Field>
        <Field label={t("driver")}>{(props) => <Input {...props} value={value.driver_name ?? ""} onChange={(event) => set("driver_name", event.target.value)} />}</Field>
        <Field label={t("operator")}>
          {(props) => (
            <Select {...props} value={value.operator} onChange={(event) => set("operator", event.target.value as BusInput["operator"])}>
              <option value="university">{t("operators.university")}</option>
              <option value="bus_company">{t("operators.bus_company")}</option>
            </Select>
          )}
        </Field>
        <Field label={t("status")}>
          {(props) => (
            <Select {...props} value={value.status} onChange={(event) => set("status", event.target.value as BusInput["status"])}>
              <option value="ok">{t("statuses.ok")}</option>
              <option value="repair">{t("statuses.repair")}</option>
            </Select>
          )}
        </Field>
      </div>
      {invalid && <Banner tone="danger">{t("invalid")}</Banner>}
      {error && <Banner tone="danger">{error}</Banner>}
      <Button type="submit" loading={save.pending}>
        {t("save")}
      </Button>
    </form>
  );
}
