"use client";

import { useTranslations } from "next-intl";

/** Mock mode only: the demo accounts, so every role can be tried without real credentials. */
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
  return (
    <section aria-labelledby="demo-accounts" className="rounded-card border border-dashed border-line-strong bg-surface-alt p-4">
      <h2 id="demo-accounts" className="text-[15px] font-bold">
        {t("title")}
      </h2>
      <p className="mb-3 text-[14px] leading-5 text-ink-muted">{t("body")}</p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ACCOUNTS.map((account) => (
          <li key={account.identifier}>
            <button
              type="button"
              onClick={() => onPick(account.identifier)}
              className="flex min-h-12 w-full flex-col items-start justify-center rounded-md border border-line bg-surface-raised px-3 py-1.5 text-start hover:border-brand"
            >
              <span className="text-[14px] font-bold text-ink-strong">{t(account.key)}</span>
              <span className="num text-[12px] text-ink-muted" dir="ltr">
                {account.identifier}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
