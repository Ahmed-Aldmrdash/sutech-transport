"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { landingPathFor } from "../access";
import type { LoginErrorKey } from "../auth-errors";
import type { OtpChallenge, Session } from "../schema";
import { sessionStore } from "../session/session-store";
import { CodeStep } from "./code-step";
import { IdentifierStep } from "./identifier-step";
import { loginStepStorage } from "./login-step-storage";

type Step =
  | { kind: "identifier"; identifier: string; error: LoginErrorKey | null }
  | { kind: "code"; identifier: string; challenge: OtpChallenge; sentAt: number };

/** The two steps of sign-in: ID → one-time code → the role's home (or the page asked for). */
export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "identifier", identifier: "", error: null });

  // Back to the code step after a language switch or reload. Layout effect: before first paint.
  useLayoutEffect(() => {
    const saved = loginStepStorage.read();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from this tab's storage
    if (saved) setStep({ kind: "code", ...saved });
  }, []);

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
