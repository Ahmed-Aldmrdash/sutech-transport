"use client";

import { ArrowRight, Info } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Tone } from "@/components/ui/tone";
import { useToast } from "@/components/ui/toast";
import { createSubscription } from "@/features/subscriptions/api";
import { SubscriptionStatusBadge } from "@/features/subscriptions/components/subscription-status-badge";
import {
  BOOKABLE_STATUSES,
  SubscriptionErrorCode,
  type Subscription,
} from "@/features/subscriptions/schema";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { errorMessageKey } from "@/lib/api/errors";
import { formatClockTime, formatMoney } from "@/lib/format";
import { LineErrorCode, type LineDetail } from "../schema";

const BOOKING_ERROR_CODES = [
  SubscriptionErrorCode.SeatUnavailable,
  SubscriptionErrorCode.AlreadySubscribed,
  SubscriptionErrorCode.StopNotOnLine,
  LineErrorCode.LineNotFound,
] as const;
type BookingErrorKey = (typeof BOOKING_ERROR_CODES)[number] | "network" | "invalid" | "generic";

interface BookingPanelProps {
  line: LineDetail;
  selectedStopId: string | null;
  /** The student's current subscription, if any. */
  current: Subscription | null;
  onBooked: () => void;
}

/** Shows what booking this line means, and books it after a confirmation. */
export function BookingPanel({ line, selectedStopId, current, onBooked }: BookingPanelProps) {
  const t = useTranslations("student");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const toast = useToast();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [errorKey, setErrorKey] = useState<BookingErrorKey | null>(null);

  const selectedStop = line.stops.find((stop) => stop.stop_id === selectedStopId) ?? null;
  const price = formatMoney(line.price_piasters, locale);
  const hasOpenBooking = current !== null && !BOOKABLE_STATUSES.includes(current.status);

  async function book() {
    if (!selectedStop) return;
    setIsBooking(true);
    setErrorKey(null);
    try {
      await createSubscription(line.line_id, selectedStop.stop_id);
      toast.show({
        title: t("line.booked"),
        description: t("line.bookedBody"),
        tone: Tone.Success,
      });
      onBooked();
      router.push("/student/payment");
    } catch (error) {
      setIsConfirming(false);
      setErrorKey(errorMessageKey(error, BOOKING_ERROR_CODES));
    } finally {
      setIsBooking(false);
    }
  }

  if (hasOpenBooking) {
    const isThisLine = current.line.line_id === line.line_id;
    return (
      <Card>
        <CardHeader
          title={isThisLine ? t("home.subscription.title") : t("line.booking.alreadyTitle")}
          actions={<SubscriptionStatusBadge status={current.status} />}
        />
        <CardBody className="flex flex-col gap-4">
          <p className="text-body-sm text-ink">
            {isThisLine
              ? `${t("line.booking.yourStop")}: ${current.stop.name}`
              : t("line.booking.alreadyBody")}
          </p>
          <ButtonLink
            href="/student"
            variant="secondary"
            iconEnd={<ArrowRight className="size-4 rtl:-scale-x-100" />}
          >
            {t("line.booking.openBooking")}
          </ButtonLink>
        </CardBody>
      </Card>
    );
  }

  if (line.seats_available <= 0) {
    return (
      <Alert tone={Tone.Warning} title={t("line.booking.fullTitle")}>
        {t("line.booking.fullBody")}
      </Alert>
    );
  }

  return (
    <Card elevation="raised">
      <CardHeader title={t("line.booking.title")} />
      <CardBody className="flex flex-col gap-4">
        {selectedStop ? (
          <div>
            <p className="text-caption text-ink-muted">{t("line.booking.yourStop")}</p>
            <p className="text-body font-bold text-ink-strong">{selectedStop.name}</p>
            {selectedStop.pickup_time ? (
              <p className="text-body-sm text-ink">
                {formatClockTime(selectedStop.pickup_time, locale)}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-body-sm text-ink-muted">{t("line.booking.chooseStop")}</p>
        )}
        <p className="flex items-start gap-2 text-body-sm text-ink">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-teal" />
          {t("line.booking.hold")}
        </p>
        {errorKey ? <Alert tone={Tone.Danger} title={t(`line.errors.${errorKey}`)} /> : null}
        <Button fullWidth withArrow disabled={!selectedStop} onClick={() => setIsConfirming(true)}>
          {t("line.booking.book")}
        </Button>
      </CardBody>
      <ConfirmDialog
        open={isConfirming && selectedStop !== null}
        onClose={() => setIsConfirming(false)}
        onConfirm={book}
        isConfirming={isBooking}
        title={t("line.confirm.title", { line: line.name })}
        description={t("line.confirm.body", {
          stop: selectedStop?.name ?? "",
          time: selectedStop?.pickup_time ? formatClockTime(selectedStop.pickup_time, locale) : "",
          price,
        })}
        confirmLabel={t("line.confirm.confirm")}
      />
    </Card>
  );
}
