"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { isMockMode } from "@/lib/config";
import { landingPathFor } from "../access";
import type { LoginErrorKey } from "../auth-errors";
import type { OtpChallenge, Session } from "../schema";
import { sessionStore } from "../session/session-store";
import { CodeStep } from "./code-step";
import { IdentifierStep } from "./identifier-step";

type Step =
  | { kind: "identifier"; identifier: string; error: LoginErrorKey | null }
  | { kind: "code"; identifier: string; challenge: OtpChallenge; sentAt: number };

/** The two steps of sign-in: ID → one-time code → the role's home (or the page asked for). */
export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "identifier", identifier: "", error: null });

  function handleSignedIn(session: Session) {
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
        onBack={(error) =>
          setStep({ kind: "identifier", identifier: step.identifier, error: error ?? null })
        }
      />
    );
  }

  return (
    <IdentifierStep
      initialIdentifier={step.identifier}
      initialError={step.error}
      showDemo={isMockMode}
      onCodeSent={(identifier, challenge) =>
        setStep({ kind: "code", identifier, challenge, sentAt: Date.now() })
      }
    />
  );
}
