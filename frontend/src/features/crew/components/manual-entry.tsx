"use client";

import { CircleCheck, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useImperativeHandle, useRef, useState, type FormEvent, type Ref } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { TextField } from "@/components/ui/input";
import { toLatinDigits } from "@/lib/format";
import { ScanAction } from "../schema";

/** What the scanner can ask of the box: get ready for the next ID, or empty it. */
export interface ManualEntryHandle {
  focus: () => void;
  clear: () => void;
}

interface ManualEntryProps {
  action: ScanAction;
  isSending: boolean;
  onEntered: (identifier: string) => void;
  ref?: Ref<ManualEntryHandle>;
}

/** For a student without their pass: the university ID, typed. An empty box says so. */
export function ManualEntry({ action, isSending, onEntered, ref }: ManualEntryProps) {
  const t = useTranslations("crew.scan");
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(
    ref,
    () => ({ focus: () => inputRef.current?.focus(), clear: () => setIdentifier("") }),
    [],
  );

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const typed = toLatinDigits(identifier).trim();
    if (!typed) {
      setError(t("manualRequired"));
      inputRef.current?.focus();
      return;
    }
    onEntered(typed);
  }

  return (
    <Card>
      <CardHeader title={t("manualTitle")} description={t("manualLead")} headingLevel={2} />
      <CardBody>
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-3">
          <TextField
            label={t("manualLabel")}
            inputMode="numeric"
            autoComplete="off"
            ref={inputRef}
            required
            value={identifier}
            error={error ?? undefined}
            onChange={(event) => {
              setIdentifier(event.target.value);
              setError(null);
            }}
          />
          <Button
            type="submit"
            variant="secondary"
            className="self-start"
            isLoading={isSending}
            iconStart={
              action === ScanAction.Board ? (
                <CircleCheck className="size-4" />
              ) : (
                <LogOut className="size-4" />
              )
            }
          >
            {action === ScanAction.Board ? t("manualBoard") : t("manualCheckout")}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
