"use client";

import { Bell, Bus, Phone, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Checkbox, Radio, Switch } from "@/components/ui/choice";
import { IconButton } from "@/components/ui/icon-button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/input";
import { GallerySection } from "./gallery-section";

const Direction = { Outbound: "outbound", Return: "return" } as const;
type Direction = (typeof Direction)[keyof typeof Direction];

const SAMPLE_LINES = [1, 2, 3, 4].map((number) => ({ value: String(number), number }));

export function ControlsSection() {
  const t = useTranslations("gallery");
  const tCommon = useTranslations("common");
  const tPreview = useTranslations("preview");
  const [direction, setDirection] = useState<Direction>(Direction.Outbound);

  return (
    <>
      <GallerySection id="buttons" title={t("sections.buttons")}>
        <Card>
          <CardBody className="flex flex-wrap items-center gap-3">
            <Button withArrow>{t("buttons.book")}</Button>
            <Button variant="secondary">{t("buttons.details")}</Button>
            <Button variant="ghost">{t("buttons.skip")}</Button>
            <Button variant="danger" iconStart={<Trash2 className="size-4" />}>
              {t("buttons.cancelBooking")}
            </Button>
            <Button isLoading>{t("buttons.saving")}</Button>
            <Button size="sm" variant="secondary">
              {t("buttons.small")}
            </Button>
            <Button disabled>{t("buttons.disabled")}</Button>
            <IconButton label={t("buttons.notifications")} icon={<Bell />} variant="secondary" />
          </CardBody>
        </Card>
      </GallerySection>

      <GallerySection id="forms" title={t("sections.forms")}>
        <Card>
          <CardBody>
            <form
              className="grid gap-5 desktop:grid-cols-2"
              onSubmit={(event) => event.preventDefault()}
            >
              <TextField
                label={t("forms.studentId")}
                hint={t("forms.studentIdHint")}
                inputMode="numeric"
                autoComplete="username"
                dir="ltr"
                required
                icon={<Bus />}
              />
              <TextField
                label={t("forms.phone")}
                error={t("forms.phoneError")}
                type="tel"
                defaultValue="0101"
                dir="ltr"
                icon={<Phone />}
              />
              <SelectField
                label={t("forms.line")}
                placeholder={t("forms.linePlaceholder")}
                options={SAMPLE_LINES.map((line) => ({
                  value: line.value,
                  label: tPreview("lineName", { number: line.number }),
                }))}
              />
              <TextAreaField
                label={t("forms.note")}
                placeholder={t("forms.notePlaceholder")}
                optionalText={tCommon("optional")}
                rows={3}
              />
              <fieldset className="flex flex-col">
                <legend className="mb-1 text-body-sm font-bold text-ink-strong">
                  {t("forms.direction")}
                </legend>
                <Radio
                  name="direction"
                  value={Direction.Outbound}
                  checked={direction === Direction.Outbound}
                  onChange={() => setDirection(Direction.Outbound)}
                  label={t("forms.outbound")}
                />
                <Radio
                  name="direction"
                  value={Direction.Return}
                  checked={direction === Direction.Return}
                  onChange={() => setDirection(Direction.Return)}
                  label={t("forms.return")}
                />
              </fieldset>
              <div className="flex flex-col">
                <Checkbox label={t("forms.agree")} description={t("forms.agreeHint")} />
                <Switch
                  label={t("forms.notifyParent")}
                  description={t("forms.notifyParentHint")}
                  defaultChecked
                />
              </div>
              <div className="desktop:col-span-2">
                <Button type="submit" withArrow>
                  {t("forms.submit")}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </GallerySection>
    </>
  );
}
