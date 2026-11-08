"use client";

import { UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { requestOtp } from "../api";
import { loginErrorKey, type LoginErrorKey } from "../auth-errors";
import { normalizeIdentifier } from "../identifier";
import { IDENTIFIER_MAX_LENGTH, type OtpChallenge } from "../schema";

const MIN_IDENTIFIER_LENGTH = 3;

/** Errors about what was typed show under the field; the rest show as a banner. */
const FIELD_ERRORS: readonly LoginErrorKey[] = ["unknownIdentifier"];

interface IdentifierStepProps {
  initialIdentifier: string;
  /** A message carried back from the code step, e.g. "too many wrong codes". */
  initialError: LoginErrorKey | null;
  onCodeSent: (identifier: string, challenge: OtpChallenge) => void;
}

export function IdentifierStep({
  initialIdentifier,
  initialError,
  onCodeSent,
}: IdentifierStepProps) {
  const t = useTranslations("login");
  const inputRef = useRef<HTMLInputElement>(null);
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<LoginErrorKey | null>(initialError);
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSending) return;
    const value = normalizeIdentifier(identifier);
    setBannerError(null);
    if (value === "") return showFieldError(t("identifierRequired"));
    if (value.length < MIN_IDENTIFIER_LENGTH) return showFieldError(t("identifierTooShort"));

    setFieldError(null);
    setIsSending(true);
    try {
      const challenge = await requestOtp(value);
      onCodeSent(value, challenge);
    } catch (error) {
      const key = loginErrorKey(error);
      if (FIELD_ERRORS.includes(key)) showFieldError(t(`errors.${key}`, { count: 0 }));
      else setBannerError(key);
      setIsSending(false);
    }
  }

  function showFieldError(message: string) {
    setFieldError(message);
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-label text-teal-text">{t("stepOf", { step: 1, total: 2 })}</p>
        <h1 className="mt-2 text-h1 text-ink-strong">{t("identifierTitle")}</h1>
        <p className="mt-2 text-body text-ink">{t("identifierLead")}</p>
      </div>

      {bannerError ? (
        <Alert tone="danger" title={t(`errors.${bannerError}`, { count: 0 })} />
      ) : null}

      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
        <TextField
          ref={inputRef}
          name="identifier"
          label={t("identifierLabel")}
          hint={t("identifierHint")}
          error={fieldError ?? undefined}
          required
          icon={<UserRound />}
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          maxLength={IDENTIFIER_MAX_LENGTH}
          placeholder="240100101"
          dir="ltr"
          className="text-body"
          autoFocus
        />
        <Button type="submit" size="lg" fullWidth withArrow isLoading={isSending}>
          {isSending ? t("sendingCode") : t("sendCode")}
        </Button>
      </form>
    </div>
  );
}
