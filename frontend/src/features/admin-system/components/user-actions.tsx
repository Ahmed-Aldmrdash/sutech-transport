"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select-field";
import { useToast } from "@/components/ui/toast";
import { Tone } from "@/components/ui/tone";
import { useSubmit } from "@/lib/hooks/use-submit";
import { updateStaffUser } from "../api";
import {
  AdminSystemErrorCode,
  STAFF_ROLES,
  type StaffRole,
  type StaffUser,
  type StaffUserChange,
} from "../schema";

const ERRORS = Object.values(AdminSystemErrorCode);

const Open = { None: "none", Toggle: "toggle", Move: "move" } as const;
type Open = (typeof Open)[keyof typeof Open];

/** Stop or allow an account, or move it to another office. Not on your own row. */
export function UserActions({ user, onChanged }: { user: StaffUser; onChanged: () => void }) {
  const t = useTranslations("desk.system.users");
  const tRoot = useTranslations();
  const toast = useToast();
  const [open, setOpen] = useState<Open>(Open.None);
  const [role, setRole] = useState<StaffRole>(user.role);
  const { submit, isSending, serverError, clearServerError } = useSubmit(ERRORS);

  if (user.is_you) return null;

  const close = () => {
    setOpen(Open.None);
    clearServerError();
  };

  async function send(change: StaffUserChange, done: string) {
    const saved = await submit((idempotencyKey) =>
      updateStaffUser(user.user_id, change, { idempotencyKey }),
    );
    if (!saved) return;
    toast.show({ title: done, tone: Tone.Success });
    setOpen(Open.None);
    onChanged();
  }

  const error = serverError ? (
    <Alert tone={Tone.Danger} title={t(`errors.${serverError}`)} />
  ) : null;

  return (
    <div className="flex flex-wrap gap-2 desktop:justify-end">
      <Button size="sm" variant="secondary" onClick={() => setOpen(Open.Move)}>
        {t("move")}
      </Button>
      <Button
        size="sm"
        variant={user.active ? "ghost" : "secondary"}
        onClick={() => setOpen(Open.Toggle)}
      >
        {user.active ? t("stop") : t("allow")}
      </Button>
      {open === Open.Toggle ? (
        <ConfirmDialog
          open
          onClose={close}
          isConfirming={isSending}
          destructive={user.active}
          title={
            user.active ? t("stopTitle", { name: user.name }) : t("allowTitle", { name: user.name })
          }
          description={user.active ? t("stopBody") : t("allowBody", { id: user.identifier })}
          confirmLabel={user.active ? t("stop") : t("allow")}
          onConfirm={() =>
            void send(
              { active: !user.active },
              user.active
                ? t("stopped_done", { name: user.name })
                : t("allowed_done", { name: user.name }),
            )
          }
        >
          {error}
        </ConfirmDialog>
      ) : null}
      {open === Open.Move ? (
        <ConfirmDialog
          open
          onClose={close}
          isConfirming={isSending}
          title={t("moveTitle", { name: user.name })}
          description={t("moveBody", { id: user.identifier })}
          confirmLabel={t("moveConfirm")}
          onConfirm={() =>
            role === user.role
              ? close()
              : void send(
                  { role },
                  t("moved_done", { name: user.name, office: tRoot(`roles.${role}`) }),
                )
          }
        >
          <div className="flex flex-col gap-4">
            <SelectField
              label={t("office")}
              value={role}
              onChange={(event) => setRole(event.target.value as StaffRole)}
              options={STAFF_ROLES.map((value) => ({ value, label: tRoot(`roles.${value}`) }))}
            />
            {error}
          </div>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
