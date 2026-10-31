"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useSession } from "@/components/providers/SessionProvider";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useErrorMessage } from "@/components/ui/States";
import { useRouter } from "@/i18n/navigation";
import { ApiError, ErrorCode, toApiError } from "@/lib/api/errors";
import { isMockMode } from "@/lib/config";
import { login, requestOtp } from "../api";
import { AREA_HOME, type Role, areaOf } from "../roles";
import type { OtpChallenge } from "../schema";
import { DemoAccounts } from "./DemoAccounts";

const CODE_LENGTH = 4;

export function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const search = useSearchParams();
  const { session, signIn } = useSession();
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(false);
  const errorMessage = useErrorMessage(error);

  useEffect(() => {
    if (session.status !== "authenticated") return;
    const home = AREA_HOME[areaOf(session.user.role as Role)];
    const next = search.get("next");
    // Only follow `next` inside the user's own area, never to another site.
    router.replace(next && next.startsWith(home) ? next : home);
  }, [session, router, search]);

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    if (identifier.trim().length < 3) {
      setError(new ApiError(400, ErrorCode.Validation, ""));
      return;
    }
    setPending(true);
    setError(null);
    try {
      setChallenge(await requestOtp(identifier.trim()));
      setCode("");
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setPending(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code)) {
      setError(new ApiError(400, ErrorCode.InvalidOtp, ""));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await login(identifier.trim(), code);
      signIn(result.token, result.user);
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setPending(false);
    }
  }

  const locked = error?.code === ErrorCode.OtpLocked;

  if (!challenge) {
    return (
      <div className="flex flex-col gap-6">
        <form onSubmit={sendCode} className="flex flex-col gap-4" noValidate>
          <Field
            label={t("identifierLabel")}
            hint={t("identifierHint")}
            error={error ? (error.code === ErrorCode.Validation ? t("identifierRequired") : errorMessage) : undefined}
          >
            {(props) => (
              <Input
                {...props}
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                autoComplete="username"
                inputMode="text"
                dir="ltr"
                className="text-start"
                placeholder="240102791"
              />
            )}
          </Field>
          <Button type="submit" block loading={pending} icon={<KeyRound className="size-4" aria-hidden />}>
            {t("sendCode")}
          </Button>
        </form>
        {isMockMode && <DemoAccounts onPick={(value) => setIdentifier(value)} />}
      </div>
    );
  }

  return (
    <form onSubmit={verify} className="flex flex-col gap-4" noValidate>
      <Banner tone="info" title={t("hello", { name: challenge.name_hint })}>
        {t("codeSent", { destination: challenge.masked_destination })}
      </Banner>
      <Field
        label={t("codeLabel")}
        hint={challenge.demo_code ? t("demoCode", { code: challenge.demo_code }) : undefined}
        error={error ? (error.code === ErrorCode.InvalidOtp ? t("wrongCode") : errorMessage) : undefined}
      >
        {(props) => (
          <Input
            {...props}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
            autoComplete="one-time-code"
            inputMode="numeric"
            dir="ltr"
            className="num text-center text-[24px] tracking-[0.5em]"
            disabled={locked}
            autoFocus
          />
        )}
      </Field>
      <Button type="submit" block loading={pending} disabled={locked}>
        {t("signIn")}
      </Button>
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => void sendCode()} disabled={pending}>
          {t("resend")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="flip-rtl size-4" aria-hidden />}
          onClick={() => {
            setChallenge(null);
            setError(null);
          }}
        >
          {t("notMe")}
        </Button>
      </div>
    </form>
  );
}
