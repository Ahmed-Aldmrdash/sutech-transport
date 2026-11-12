"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Tone } from "@/components/ui/tone";
import { errorMessageKey } from "@/lib/api/errors";
import { downloadReport } from "../download";
import {
  PDF_MAX_ROWS,
  ReportErrorCode,
  ReportFormat,
  type ReportFileFormat,
  type ReportFilters,
  type ReportType,
} from "../schema";

const ERRORS = Object.values(ReportErrorCode);

/** Excel and PDF of the report on screen, with the same filter. */
export function ExportButtons({
  type,
  filters,
  lineCode,
  total,
}: {
  type: ReportType;
  filters: ReportFilters;
  lineCode: string | null;
  total: number;
}) {
  const t = useTranslations("desk.reports");
  const toast = useToast();
  const [busy, setBusy] = useState<ReportFileFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tooBigForPdf = total > PDF_MAX_ROWS;

  async function download(format: ReportFileFormat) {
    setBusy(format);
    setError(null);
    try {
      await downloadReport(type, filters, format, lineCode);
      toast.show({ title: t("downloaded"), tone: Tone.Success });
    } catch (caught) {
      setError(t(`errors.${errorMessageKey(caught, ERRORS)}`));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          iconStart={<FileSpreadsheet />}
          isLoading={busy === ReportFormat.Xlsx}
          disabled={busy !== null || total === 0}
          onClick={() => void download(ReportFormat.Xlsx)}
        >
          {t("excel")}
        </Button>
        <Button
          variant="secondary"
          iconStart={<FileText />}
          isLoading={busy === ReportFormat.Pdf}
          disabled={busy !== null || total === 0 || tooBigForPdf}
          onClick={() => void download(ReportFormat.Pdf)}
        >
          {t("pdf")}
        </Button>
      </div>
      {tooBigForPdf ? (
        <p className="text-caption text-ink-muted">{t("pdfTooBig", { max: PDF_MAX_ROWS })}</p>
      ) : null}
      {error ? <Alert tone={Tone.Danger} title={error} /> : null}
    </div>
  );
}
