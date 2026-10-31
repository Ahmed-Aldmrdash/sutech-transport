"use client";

import { ChevronDown, FlaskConical } from "lucide-react";
import { useTranslations } from "next-intl";

/** Mock mode only: the demo accounts, so every role can be tried without real credentials. Collapsed by default. */
const ACCOUNTS = [
  { identifier: "240102791", key: "studentNew" },
  { identifier: "240102684", key: "studentActive" },
  { identifier: "parent-240102791", key: "parent" },
  { identifier: "driver", key: "driver" },
  { identifier: "supervisor", key: "supervisor" },
  { identifier: "admin", key: "superAdmin" },
  { identifier: "transport", key: "transport" },
  { identifier: "finance", key: "finance" },
  { identifier: "clinic", key: "clinic" },
  { identifier: "affairs", key: "affairs" },
  { identifier: "secretary", key: "secretary" },
  { identifier: "abulhoul", key: "busCompany" },
] as const;

export function DemoAccounts({ onPick }: { onPick: (identifier: string) => void }) {
  const t = useTranslations("auth.demo");
  const ta = useTranslations("auth");
  return (
    <details className="group rounded-card border border-dashed border-line-strong">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 text-[14px] font-bold text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden">
        <FlaskConical className="size-4" aria-hidden />
        {ta("demoToggle")}
        <ChevronDown className="ms-auto size-4 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-dashed border-line-strong p-4">
        <p className="mb-3 text-[13px] leading-5 text-ink-muted">{t("body")}</p>
        <ul className="grid grid-cols-2 gap-2">
          {ACCOUNTS.map((account) => (
            <li key={account.identifier}>
              <button
                type="button"
                onClick={() => onPick(account.identifier)}
                className="flex min-h-12 w-full flex-col items-start justify-center rounded-md border border-line bg-surface-raised px-3 py-1.5 text-start hover:border-brand"
              >
                <span className="text-[13px] leading-5 font-bold text-ink-strong">{t(account.key)}</span>
                <span className="num text-[12px] text-ink-muted" dir="ltr">
                  {account.identifier}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
