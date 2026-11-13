"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { useToast } from "@/components/ui/toast";
import { Tone } from "@/components/ui/tone";
import { Role } from "@/lib/auth/roles";
import { useSubmit } from "@/lib/hooks/use-submit";
import { createStaffUser } from "../api";
import { AdminSystemErrorCode, PHONE_PATTERN, STAFF_ROLES, type StaffRole } from "../schema";

const ERRORS = Object.values(AdminSystemErrorCode);
const NAME_MIN_LENGTH = 3;
const NAME_MAX_LENGTH = 60;
const PHONE_LENGTH = 11;

/** A new office account: name in both languages, the phone the code goes to, and its office. */
export function AddUserDialog({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const t = useTranslations("desk.system.users");
  const tRoot = useTranslations();
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<StaffRole>(Role.Transport);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const { submit, isSending, serverError } = useSubmit(ERRORS);

  async function onConfirm() {
    const found = {
      name: name.trim().length < NAME_MIN_LENGTH ? t("nameError") : undefined,
      phone: PHONE_PATTERN.test(phone.trim()) ? undefined : t("phoneError"),
    };
    setErrors(found);
    if (found.name || found.phone) return;
    const added = await submit((idempotencyKey) =>
      createStaffUser(
        { name: name.trim(), name_ar: nameAr.trim() || null, phone: phone.trim(), role },
        { idempotencyKey },
      ),
    );
    if (!added) return;
    toast.show({ title: t("added", { id: added.identifier }), tone: Tone.Success });
    onAdded();
  }

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      onConfirm={() => void onConfirm()}
      isConfirming={isSending}
      title={t("addTitle")}
      description={t("addBody")}
      confirmLabel={t("addConfirm")}
    >
      <div className="flex flex-col gap-4">
        <TextField
          label={t("nameEn")}
          hint={t("nameHint")}
          required
          autoComplete="off"
          maxLength={NAME_MAX_LENGTH}
          value={name}
          error={errors.name}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label={t("nameAr")}
          optionalText={tCommon("optional")}
          dir="rtl"
          autoComplete="off"
          maxLength={NAME_MAX_LENGTH}
          value={nameAr}
          onChange={(event) => setNameAr(event.target.value)}
        />
        <TextField
          label={t("phone")}
          hint={t("phoneHint")}
          required
          type="tel"
          inputMode="numeric"
          dir="ltr"
          autoComplete="off"
          maxLength={PHONE_LENGTH}
          value={phone}
          error={errors.phone}
          onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))}
        />
        <SelectField
          label={t("office")}
          value={role}
          onChange={(event) => setRole(event.target.value as StaffRole)}
          options={STAFF_ROLES.map((value) => ({ value, label: tRoot(`roles.${value}`) }))}
        />
        {serverError ? <Alert tone={Tone.Danger} title={t(`errors.${serverError}`)} /> : null}
      </div>
    </ConfirmDialog>
  );
}
