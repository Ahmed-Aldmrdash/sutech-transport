"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useIsHydrated } from "@/lib/hooks/use-is-hydrated";
import { login, requestOtp } from "../api";
import { loginErrorKey, type LoginErrorKey } from "../auth-errors";
import { sanitizeCode } from "../identifier";
import type { OtpChallenge, Session } from "../schema";
import { useCountdown } from "../use-countdown";
import { CodeFooter, CodeHeading, CodeInput } from "./code-step-parts";

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
  /** A reload stays on this step (server-rendered); see IdentifierStep. */
  const isHydrated = useIsHydrated();

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
      <CodeHeading challenge={challenge} />

      {bannerError ? (
        <Alert tone="danger" title={t(`errors.${bannerError}`, { count: attemptsLeft })} />
      ) : null}
      {isExpired ? <Alert tone="warning" title={t("codeExpired")} /> : null}

      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
        <CodeInput
          ref={inputRef}
          length={length}
          value={code}
          error={error}
          isVerifying={isVerifying}
          isExpired={isExpired}
          onChange={handleChange}
        />

        <Button
          type="submit"
          size="lg"
          fullWidth
          withArrow
          isLoading={isVerifying}
          disabled={isExpired || !isHydrated}
        >
          {isVerifying ? t("verifying") : t("verify")}
        </Button>
      </form>

      <CodeFooter
        expiresIn={expiresIn}
        resendIn={resendIn}
        isResending={isResending}
        isVerifying={isVerifying}
        onBack={() => onBack()}
        onResend={() => void resend()}
      />
    </div>
  );
}
