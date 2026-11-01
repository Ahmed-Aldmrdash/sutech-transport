"use client";

import { ChevronDown, FlaskConical } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { MOCK_ACCOUNTS, MOCK_OTP_CODE } from "../mock-accounts";

/** Mock mode only: one tap fills a role's ID, so every role can be tried without a server. */
export function DemoAccounts({ onPick }: { onPick: (identifier: string) => void }) {
  const t = useTranslations();
  return (
    <details className="group rounded-md border border-dashed border-line-strong bg-surface-alt/60">
      <summary className="flex min-h-tap cursor-pointer list-none items-center gap-3 rounded-md px-4 text-body-sm font-bold text-ink-strong focus-ring [&::-webkit-details-marker]:hidden">
        <FlaskConical aria-hidden="true" className="size-5 text-teal-text" />
        <span className="flex-1">{t("login.demo.title")}</span>
        <ChevronDown
          aria-hidden="true"
          className="size-5 text-ink-muted transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <p className="text-body-sm text-ink-muted">
          {t("login.demo.body", { code: MOCK_OTP_CODE })}
        </p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MOCK_ACCOUNTS.map(({ user, disabled }) => {
            const roleName = disabled ? t("login.demo.disabled") : t(`roles.${user.role}`);
            return (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => onPick(user.identifier)}
                  aria-label={t("login.demo.use", { role: roleName })}
                  className="flex min-h-tap w-full flex-col items-start justify-center rounded-md border border-line bg-surface-raised px-3 py-1.5 text-start focus-ring hover:border-brand hover:bg-brand-soft"
                >
                  <span className="text-body-sm font-bold text-ink-strong">{roleName}</span>
                  <bdi dir="ltr" className="text-caption text-ink-muted">
                    {user.identifier}
                  </bdi>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm">
          <Link href="/ui" className="font-bold text-brand underline-offset-4 hover:underline">
            {t("login.demo.gallery")}
          </Link>
          <Link
            href="/preview/student"
            className="font-bold text-brand underline-offset-4 hover:underline"
          >
            {t("login.demo.previews")}
          </Link>
        </p>
      </div>
    </details>
  );
}
