"use client";

import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { useMe } from "@/components/providers/SessionProvider";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { useErrorMessage } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { Role } from "@/features/auth/roles";
import { listLines } from "@/features/lines/api";
import { useApi, useMutation } from "@/lib/api/use-api";
import { isMockMode } from "@/lib/config";
import { cairoDate } from "@/lib/time";
import { downloadReport, exportReport } from "../api";
import { ReportType } from "../schema";

type Format = "xlsx" | "pdf" | "csv";

/** Each role exports only the reports of its own work. */
const REPORTS_BY_ROLE: Partial<Record<string, ReportType[]>> = {
  [Role.Finance]: [ReportType.Payments],
  [Role.TransportAdmin]: [ReportType.Roster, ReportType.Attendance, ReportType.Occupancy],
};
const ALL_REPORTS = Object.values(ReportType);
const NEEDS_LINE: ReportType[] = [ReportType.Roster, ReportType.Attendance];

export function ReportsScreen() {
  const t = useTranslations("admin.reports");
  const me = useMe();
  const types = REPORTS_BY_ROLE[me.role] ?? ALL_REPORTS;
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {isMockMode && <Banner className="mb-4">{t("demoCsv")}</Banner>}
      <div className="grid gap-4 md:grid-cols-2">
        {types.map((type) => (
          <ReportCard key={type} type={type} />
        ))}
      </div>
    </>
  );
}

function ReportCard({ type }: { type: ReportType }) {
  const t = useTranslations("admin.reports");
  const toast = useToast();
  const lines = useApi(listLines);
  const [lineId, setLineId] = useState("");
  const [date, setDate] = useState(cairoDate());
  const [format, setFormat] = useState<Format>("xlsx");
  const run = useMutation(exportReport);
  const error = useErrorMessage(run.error);
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle action={<FileSpreadsheet className="size-5 text-brand" aria-hidden />}>{t(`types.${type}.title`)}</CardTitle>
      <p className="text-[14px] text-ink-muted">{t(`types.${type}.body`)}</p>
      {NEEDS_LINE.includes(type) && (
        <Field label={t("line")}>
          {(props) => (
            <Select {...props} value={lineId} onChange={(event) => setLineId(event.target.value)}>
              <option value="">{t("allLines")}</option>
              {(lines.data?.items ?? []).map((line) => (
                <option key={line.id} value={line.id}>
                  {line.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      {type === ReportType.Attendance && <Field label={t("date")}>{(props) => <Input {...props} type="date" max={cairoDate()} value={date} onChange={(event) => setDate(event.target.value)} />}</Field>}
      <Field label={t("format")}>
        {(props) => (
          <Select {...props} value={format} onChange={(event) => setFormat(event.target.value as Format)}>
            <option value="xlsx">Excel (.xlsx)</option>
            <option value="pdf">PDF</option>
            <option value="csv">CSV</option>
          </Select>
        )}
      </Field>
      {error && <Banner tone="danger">{error}</Banner>}
      <Button
        variant="secondary"
        icon={<Download className="size-4" aria-hidden />}
        loading={run.pending}
        onClick={async () => {
          const file = await run.run(type, { line: lineId || undefined, date: type === ReportType.Attendance ? date : undefined, format });
          if (file) {
            downloadReport(file);
            toast(t("downloaded", { rows: file.rows }));
          }
        }}
      >
        {t("download")}
      </Button>
    </Card>
  );
}
