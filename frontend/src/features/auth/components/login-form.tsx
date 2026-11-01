"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { landingPathFor } from "../access";
import type { LoginErrorKey } from "../auth-errors";
import type { OtpChallenge, Session } from "../schema";
import { sessionStore } from "../session/session-store";
import { CodeStep } from "./code-step";
import { IdentifierStep } from "./identifier-step";
import { loginStepStorage, type SavedCodeStep } from "./login-step-storage";

type Step =
  | { kind: "identifier"; identifier: string; error: LoginErrorKey | null }
  | { kind: "code"; identifier: string; challenge: OtpChallenge; sentAt: number };

/** The two steps of sign-in: ID → one-time code → the role's home (or the page asked for). */
export function LoginForm({
  next,
  savedCodeStep,
}: {
  next: string | null;
  /** From the cookie, read by the server: a reload or language switch stays on the code step. */
  savedCodeStep: SavedCodeStep | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(() =>
    savedCodeStep
      ? { kind: "code", ...savedCodeStep }
      : { kind: "identifier", identifier: "", error: null },
  );

  useEffect(() => {
    if (step.kind === "code") {
      const { identifier, challenge, sentAt } = step;
      loginStepStorage.save({ identifier, challenge, sentAt });
    }
  }, [step]);

  function handleSignedIn(session: Session) {
    loginStepStorage.clear();
    sessionStore.start(session);
    router.replace(landingPathFor(session.user.role, next));
  }

  if (step.kind === "code") {
    return (
      <CodeStep
        identifier={step.identifier}
        challenge={step.challenge}
        sentAt={step.sentAt}
        onResent={(challenge) => setStep({ ...step, challenge, sentAt: Date.now() })}
        onSignedIn={handleSignedIn}
        onBack={(error) => {
          loginStepStorage.clear();
          setStep({ kind: "identifier", identifier: step.identifier, error: error ?? null });
        }}
      />
    );
  }

  return (
    <IdentifierStep
      initialIdentifier={step.identifier}
      initialError={step.error}
      onCodeSent={(identifier, challenge) =>
        setStep({ kind: "code", identifier, challenge, sentAt: Date.now() })
      }
    />
  );
}
