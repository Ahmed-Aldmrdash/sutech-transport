"use client";

import { type FormEvent, useState } from "react";
import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useErrorMessage } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useMutation } from "@/lib/api/use-api";
import { PAYMENT_DETAILS } from "@/lib/config";
import { uploadReceipt } from "../api";
import { MAX_RECEIPT_BYTES, ReceiptUpload } from "../schema";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** InstaPay or bank transfer: the student pays, then uploads the receipt and its reference for finance to review. */
export function ReceiptForm({ method }: { method: "instapay" | "bank_transfer" }) {
  const t = useTranslations("student.payment");
  const toast = useToast();
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<"reference" | "file" | "size" | null>(null);
  const upload = useMutation(uploadReceipt);
  const error = useErrorMessage(upload.error);
  const account = method === "instapay" ? PAYMENT_DETAILS.instapay : PAYMENT_DETAILS.bank;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || !IMAGE_TYPES.includes(file.type)) return setProblem("file");
    if (file.size > MAX_RECEIPT_BYTES) return setProblem("size");
    const body = { method, reference: reference.trim(), image: await readAsDataUrl(file) };
    if (!ReceiptUpload.safeParse(body).success) return setProblem("reference");
    setProblem(null);
    if (await upload.run(body)) toast(t("receiptSent"));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Banner tone="info" title={t(method === "instapay" ? "instapayTo" : "bankTo")}>
        {account ? (
          <span className="num font-bold" dir="ltr">
            {account}
          </span>
        ) : (
          t("accountFromFinance")
        )}
      </Banner>
      <Field label={t("reference")} hint={t("referenceHint")} error={problem === "reference" ? t("referenceInvalid") : undefined}>
        {(props) => <Input {...props} value={reference} onChange={(event) => setReference(event.target.value)} dir="ltr" className="text-start" autoComplete="off" />}
      </Field>
      <Field
        label={t("receiptImage")}
        hint={t("receiptHint")}
        error={problem === "file" ? t("receiptMissing") : problem === "size" ? t("receiptTooBig") : undefined}
      >
        {(props) => (
          <Input
            {...props}
            type="file"
            accept={IMAGE_TYPES.join(",")}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="py-2.5 file:me-3 file:rounded-sm file:border-0 file:bg-brand-soft file:px-3 file:py-1 file:font-bold file:text-brand"
          />
        )}
      </Field>
      {error && <Banner tone="danger">{error}</Banner>}
      <Button type="submit" icon={<Upload className="size-4" aria-hidden />} loading={upload.pending}>
        {t("sendReceipt")}
      </Button>
    </form>
  );
}
