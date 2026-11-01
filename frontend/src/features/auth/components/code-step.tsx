"use client";

import { ArrowLeft, KeyRound, RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, controlStyles } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { login, requestOtp } from "../api";
import { loginErrorKey, type LoginErrorKey } from "../auth-errors";
import { sanitizeCode } from "../identifier";
import type { OtpChallenge, Session } from "../schema";
import { formatCountdown, useCountdown } from "../use-countdown";

const MS_PER_SECOND = 1000;

interface CodeStepProps {
  identifier: string;
  challenge: OtpChallenge;
  /** When the current code was sent (epoch ms). */
  sentAt: number;
  onResent: (challenge: OtpChallenge) => void;
  onSignedIn: (session: Session) => void;
  /** Back to step 1, optionally with a message to show there. */
  onBack: (error?: LoginErrorKey) => void;
}

export function CodeStep({
  identifier,
  challenge,
  sentAt,
  onResent,
  onSignedIn,
  onBack,
}: CodeStepProps) {
  const t = useTranslations("login");
  const { show: showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState(challenge.attempts_left);
  const [error, setError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<LoginErrorKey | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const length = challenge.code_length;
  const expiresIn = useCountdown(sentAt + challenge.expires_in_seconds * MS_PER_SECOND);
  const resendIn = useCountdown(sentAt + challenge.resend_after_seconds * MS_PER_SECOND);
  const isExpired = expiresIn === 0;

  async function verify(value: string) {
    if (isVerifying) return;
    if (value.length !== length) {
      setError(t("codeIncomplete", { length }));
      inputRef.current?.focus();
      return;
    }
    setError(null);
    setBannerError(null);
    setIsVerifying(true);
    try {
      onSignedIn(await login(identifier, value));
    } catch (caught) {
      setIsVerifying(false);
      handleLoginError(loginErrorKey(caught));
    }
  }

  function handleLoginError(key: LoginErrorKey) {
    if (key === "otpLocked") return onBack(key);
    setCode("");
    if (key === "invalidOtp") {
      const left = Math.max(attemptsLeft - 1, 0);
      setAttemptsLeft(left);
      setError(t("errors.invalidOtp", { count: left }));
    } else if (key === "otpExpired") {
      setError(t("errors.otpExpired"));
    } else {
      setBannerError(key);
    }
    inputRef.current?.focus();
  }

  async function resend() {
    setIsResending(true);
    setError(null);
    setBannerError(null);
    try {
      const next = await requestOtp(identifier);
      setCode("");
      setAttemptsLeft(next.attempts_left);
      onResent(next);
      showToast({ tone: "success", title: t("resent") });
      inputRef.current?.focus();
    } catch (caught) {
      const key = loginErrorKey(caught);
      if (key === "otpLocked") return onBack(key);
      setBannerError(key);
    } finally {
      setIsResending(false);
    }
  }

  function handleChange(raw: string) {
    const value = sanitizeCode(raw, length);
    setCode(value);
    if (error) setError(null);
    if (value.length === length && !isExpired) void verify(value);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void verify(code);
  }

  return (
    <div className="flex flex-col gap-6">
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

      {challenge.demo_code ? (
        <p className="self-start rounded-pill bg-teal-soft px-3 py-1 text-body-sm font-bold text-teal-text">
          {t("demoCode", { code: challenge.demo_code })}
        </p>
      ) : null}

      {bannerError ? (
        <Alert tone="danger" title={t(`errors.${bannerError}`, { count: attemptsLeft })} />
      ) : null}
      {isExpired ? <Alert tone="warning" title={t("codeExpired")} /> : null}

      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field label={t("codeLabel")} error={error ?? undefined} required>
          {(control) => (
            <div className="relative" dir="ltr">
              <KeyRound
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 start-3 my-auto size-5 text-ink-muted"
              />
              <input
                ref={inputRef}
                {...control}
                name="code"
                value={code}
                onChange={(event) => handleChange(event.target.value)}
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
                  "h-14 ps-[calc(2.5rem+0.6em)] pe-10 text-center text-[26px] font-extrabold tracking-[0.6em] tabular-nums",
                  "placeholder:tracking-[0.6em]",
                )}
              />
            </div>
          )}
        </Field>

        <Button
          type="submit"
          size="lg"
          fullWidth
          withArrow
          isLoading={isVerifying}
          disabled={isExpired}
        >
          {isVerifying ? t("verifying") : t("verify")}
        </Button>
      </form>

      <div className="flex flex-col gap-3 border-t border-line pt-5">
        <p className="text-body-sm text-ink-muted" aria-live="off">
          {isExpired ? t("codeExpired") : t("expiresIn", { time: formatCountdown(expiresIn) })}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="-ms-4"
            iconStart={<ArrowLeft className="size-4 rtl:-scale-x-100" />}
            onClick={() => onBack()}
          >
            {t("changeIdentifier")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            iconStart={<RotateCw className="size-4" />}
            onClick={() => void resend()}
            isLoading={isResending}
            disabled={resendIn > 0 || isVerifying}
          >
            {resendIn > 0 ? t("resendIn", { time: formatCountdown(resendIn) }) : t("resend")}
          </Button>
        </div>
      </div>
    </div>
  );
}
