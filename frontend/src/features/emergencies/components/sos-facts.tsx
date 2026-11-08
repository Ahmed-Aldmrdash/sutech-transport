"use client";

import { MapPin, Phone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BusMap } from "@/features/tracking/components/bus-map";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatPhone, formatTime } from "@/lib/format";
import type { AdminSos } from "../schema";

export function Fact({
  label,
  icon,
  className,
  children,
}: {
  label: string;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 items-start gap-2", className)}>
      {icon ? (
        <span aria-hidden="true" className="mt-0.5 shrink-0 text-teal [&_svg]:size-5">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <dt className="text-caption text-ink-muted">{label}</dt>
        <dd className="text-body-sm font-bold text-ink-strong">{children}</dd>
      </div>
    </div>
  );
}

export function CallLink({ name, phone }: { name: string; phone: string }) {
  const t = useTranslations("emergencies");
  return (
    <a
      href={`tel:${phone}`}
      aria-label={t("call", { name })}
      className="inline-flex min-h-tap items-center gap-2 text-brand underline-offset-2 focus-ring hover:underline"
    >
      <Phone aria-hidden="true" className="size-4 shrink-0" />
      <span>
        {name} · <bdi dir="ltr">{formatPhone(phone)}</bdi>
      </span>
    </a>
  );
}

export function LocationCard({ sos }: { sos: AdminSos }) {
  const t = useTranslations("emergencies");
  const locale = useLocale() as Locale;
  const { location } = sos;
  return (
    <Card elevation="raised">
      <CardHeader title={t("location")} headingLevel={2} />
      <CardBody className="flex flex-col gap-3">
        {location ? (
          <>
            <BusMap
              bus={{ lat: location.lat, lng: location.lng, heading: null }}
              trail={[]}
              campus={sos.campus_location}
              stop={null}
              className="h-72 desktop:h-[22rem]"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-caption text-ink-muted">
                {t("fromGps", { time: formatTime(location.fix_at, locale) })} ·{" "}
                <bdi dir="ltr">
                  {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                </bdi>
              </p>
              <a
                href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
                target="_blank"
                rel="noreferrer"
                className={buttonStyles({ variant: "secondary", size: "sm" })}
              >
                <MapPin aria-hidden="true" className="size-4" />
                {t("openInMaps")}
              </a>
            </div>
          </>
        ) : (
          <p className="text-body-sm text-ink-muted">{t("noLocation")}</p>
        )}
      </CardBody>
    </Card>
  );
}

