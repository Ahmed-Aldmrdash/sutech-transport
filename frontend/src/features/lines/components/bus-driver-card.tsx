"use client";

import { BusFront, Phone, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/format";
import type { Bus } from "../schema";

/** The bus (type and plate) and its driver, with a call button for the line's own riders. */
export function BusDriverCard({ bus, className }: { bus: Bus; className?: string }) {
  const t = useTranslations("bus");
  return (
    <Card className={className}>
      <CardHeader title={t("title")} headingLevel={2} />
      <CardBody>
        <BusDriverDetails bus={bus} />
      </CardBody>
    </Card>
  );
}

/** The same details without the card, for places that already have one. */
export function BusDriverDetails({ bus }: { bus: Bus }) {
  const t = useTranslations("bus");
  const tRoot = useTranslations();
  const driver = bus.driver;
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        {/* dt and dd sit right in the row's div (a dl allows one wrapping div, no deeper). */}
        <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 border-t border-line py-2.5">
          <dt className="col-span-2 grid grid-cols-subgrid items-center text-caption text-ink-muted">
            <BusFront aria-hidden="true" className="size-5 text-teal" />
            {t("bus")}
          </dt>
          <dd className="col-start-2 text-body-sm font-bold text-ink-strong">
            {tRoot(`student.busType.${bus.bus_type}`)} ·{" "}
            <bdi className="whitespace-nowrap">{bus.plate}</bdi>
          </dd>
        </div>
        <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 border-t border-line py-2.5">
          <dt className="col-span-2 grid grid-cols-subgrid items-center text-caption text-ink-muted">
            <UserRound aria-hidden="true" className="size-5 text-teal" />
            {t("driver")}
          </dt>
          <dd className="col-start-2 text-body-sm font-bold text-ink-strong">
            {driver ? driver.name : t("noDriver")}
          </dd>
          {driver?.phone ? (
            <dd className="col-start-2 text-caption text-ink-muted">
              <bdi dir="ltr">{formatPhone(driver.phone)}</bdi>
            </dd>
          ) : null}
        </div>
      </dl>
      {driver?.phone ? (
        <a
          href={`tel:${driver.phone}`}
          className={cn(buttonStyles({ variant: "secondary", size: "sm" }), "self-start")}
        >
          <Phone aria-hidden="true" className="size-4" />
          <span className="truncate">{t("call", { name: driver.name })}</span>
        </a>
      ) : driver ? (
        <p className="text-caption text-ink-muted">{t("phoneHidden")}</p>
      ) : null}
    </div>
  );
}
