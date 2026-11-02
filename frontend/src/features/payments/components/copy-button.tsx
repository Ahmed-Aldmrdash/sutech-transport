"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { IconButton } from "@/components/ui/icon-button";

const COPIED_MS = 2000;

/** Copies one bank detail; the icon turns into a tick for a moment. */
export function CopyButton({ value, field }: { value: string; field: string }) {
  const t = useTranslations("student.payment.bank");
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isCopied) return;
    const timer = setTimeout(() => setIsCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [isCopied]);

  return (
    <>
      <IconButton
        label={t("copy", { field })}
        icon={isCopied ? <Check className="text-success" /> : <Copy />}
        size="sm"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => setIsCopied(true));
        }}
      />
      <span role="status" className="sr-only">
        {isCopied ? t("copied", { field }) : ""}
      </span>
    </>
  );
}
