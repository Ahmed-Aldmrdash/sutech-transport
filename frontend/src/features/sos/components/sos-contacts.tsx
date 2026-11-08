"use client";

import { Ambulance, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/format";
import { EMERGENCY_CONTACTS } from "../contacts";

export function Contacts() {
  const t = useTranslations("sos.contacts");
  return (
    <Card>
      <CardHeader title={t("title")} headingLevel={2} />
      <CardBody className="flex flex-col gap-3">
        {EMERGENCY_CONTACTS.map((contact) => (
          <a
            key={contact.key}
            href={`tel:${contact.phone}`}
            aria-label={t("call", { name: t(contact.key) })}
            className={cn(
              buttonStyles({
                variant: contact.key === "ambulance" ? "danger" : "secondary",
                fullWidth: true,
              }),
              "justify-between",
            )}
          >
            <span className="inline-flex items-center gap-2">
              {contact.key === "ambulance" ? (
                <Ambulance aria-hidden="true" className="size-5" />
              ) : (
                <Phone aria-hidden="true" className="size-5" />
              )}
              {t(contact.key)}
            </span>
            <bdi dir="ltr">
              {contact.phone.length > 6 ? formatPhone(contact.phone) : contact.phone}
            </bdi>
          </a>
        ))}
      </CardBody>
    </Card>
  );
}
