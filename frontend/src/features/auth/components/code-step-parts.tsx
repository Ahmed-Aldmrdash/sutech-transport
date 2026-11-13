"use client";

import { ArrowLeft, KeyRound, RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Ref } from "react";
import { Button } from "@/components/ui/button";
import { Field, controlStyles } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { isMockMode } from "@/lib/config";
import { formatCountdown } from "../use-countdown";
import type { OtpChallenge } from "../schema";

/** Step 2's title, where the code went, and the demo code in mock mode. */
export function CodeHeading({ challenge }: { challenge: OtpChallenge }) {
  const t = useTranslations("login");
  const length = challenge.code_length;
  return (
    <>
      <div>
        <p className="text-label text-teal-text">{t("stepOf", { step: 2, total: 2 })}</p>
        <h1 className="mt-2 text-h1 text-ink-strong">{t("codeTitle")}</h1>
        <p className="mt-2 text-body text-ink">
          {t.rich("codeLead", {
            name: challenge.name_hint,
            length,
            destination: challenge.masked_destination,
            phone: (chunks) => (
              <bdi dir="ltr" className="font-bold whitespace-nowrap text-ink-strong">
                {chunks}
              </bdi>
            ),
          })}
        </p>
      </div>

      {isMockMode && challenge.demo_code ? (
        <p className="self-start rounded-pill bg-teal-soft px-3 py-1 text-body-sm font-bold text-teal-text">
          {t("demoCode", { code: challenge.demo_code })}
        </p>
      ) : null}
    </>
  );
}

interface CodeInputProps {
  ref: Ref<HTMLInputElement>;
  length: number;
  value: string;
  error: string | null;
  isVerifying: boolean;
  isExpired: boolean;
  onChange: (raw: string) => void;
}

/** One wide box for the whole code, so a pasted or auto-filled code lands at once. */
export function CodeInput({
  ref,
  length,
  value,
  error,
  isVerifying,
  isExpired,
  onChange,
}: CodeInputProps) {
  const t = useTranslations("login");
  return (
    <Field label={t("codeLabel")} error={error ?? undefined} required>
      {(control) => (
        <div className="relative" dir="ltr">
          <KeyRound
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 start-3 my-auto size-5 text-ink-muted"
          />
          <input
            ref={ref}
            {...control}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            enterKeyHint="done"
            pattern="[0-9]*"
            maxLength={length}
            placeholder={"•".repeat(length)}
            readOnly={isVerifying}
            disabled={isExpired}
            autoFocus
            className={cn(
              controlStyles,
              "h-14 ps-[calc(2.5rem+0.6em)] pe-10 text-center text-h1 font-extrabold tracking-[0.6em] tabular-nums",
              "placeholder:tracking-[0.6em]",
            )}
          />
        </div>
      )}
    </Field>
  );
}

interface CodeFooterProps {
  expiresIn: number | null;
  resendIn: number | null;
  isResending: boolean;
  isVerifying: boolean;
  onBack: () => void;
  onResend: () => void;
}

/** How long the code lasts, going back to step 1, and sending a new code. */
export function CodeFooter({
  expiresIn,
  resendIn,
  isResending,
  isVerifying,
  onBack,
  onResend,
}: CodeFooterProps) {
  const t = useTranslations("login");
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-5">
      <p
        className={cn("text-body-sm text-ink-muted", expiresIn === null && "invisible")}
        aria-live="off"
      >
        {expiresIn === 0
          ? t("codeExpired")
          : t("expiresIn", { time: formatCountdown(expiresIn ?? 0) })}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="-ms-4"
          iconStart={<ArrowLeft className="size-4 rtl:-scale-x-100" />}
          onClick={onBack}
        >
          {t("changeIdentifier")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          iconStart={<RotateCw className="size-4" />}
          onClick={onResend}
          isLoading={isResending}
          disabled={resendIn !== 0 || isVerifying}
        >
          {resendIn ? t("resendIn", { time: formatCountdown(resendIn) }) : t("resend")}
        </Button>
      </div>
    </div>
  );
}
