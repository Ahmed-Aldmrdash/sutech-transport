import {
  Bus,
  CircleCheck,
  Clock,
  CreditCard,
  Languages,
  Megaphone,
  TriangleAlert,
  UserX,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Badge, LiveDot } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { List, ListItem } from "@/components/ui/list";
import { StatTile } from "@/components/ui/stat-tile";
import { formatMoney } from "@/lib/format";
import { GallerySection } from "./gallery-section";

const SAMPLE_MINUTES = 12;
const SAMPLE_SEATS_LEFT = 14;
const SAMPLE_SEATS_TOTAL = 48;
const SAMPLE_AMOUNT_PIASTERS = 150_000;

export function DisplaySection() {
  const t = useTranslations("gallery");
  const tPreview = useTranslations("preview");
  const locale = useLocale();

  return (
    <>
      <GallerySection id="cards" title={t("sections.cards")}>
        <div className="grid grid-cols-1 gap-4 desktop:grid-cols-3">
          <Card elevation="raised" className="desktop:col-span-1">
            <CardHeader
              title={t("cards.nextBus")}
              actions={
                <Badge tone="info" icon={<LiveDot className="size-2" />}>
                  {t("cards.live")}
                </Badge>
              }
            />
            <CardBody>
              <p className="text-body-sm text-ink-muted">{t("cards.nextBusBody")}</p>
              <p className="mt-2 text-numeric text-ink-strong">
                {t("cards.minutes", { count: SAMPLE_MINUTES })}
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-pill bg-surface-alt">
                <div className="h-full w-2/3 rounded-pill bg-coral" />
              </div>
            </CardBody>
          </Card>
          <StatTile
            label={t("cards.seats")}
            value={SAMPLE_SEATS_LEFT}
            caption={tPreview("kpiOfSeats", { total: SAMPLE_SEATS_TOTAL })}
            icon={<Bus />}
          />
          <StatTile
            label={t("cards.amountDue")}
            value={<span className="num">{formatMoney(SAMPLE_AMOUNT_PIASTERS, locale)}</span>}
            icon={<CreditCard />}
          />
        </div>
      </GallerySection>

      <GallerySection id="status" title={t("sections.status")}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="success" icon={<CircleCheck />}>
              {t("status.active")}
            </Badge>
            <Badge tone="warning" icon={<Clock />}>
              {t("status.pending")}
            </Badge>
            <Badge tone="info" icon={<LiveDot className="size-2" />}>
              {t("status.onTime")}
            </Badge>
            <Badge tone="warning" icon={<TriangleAlert />}>
              {t("status.delayed")}
            </Badge>
            <Badge tone="danger" icon={<UserX />}>
              {t("status.absent")}
            </Badge>
            <Badge tone="brand">{t("status.draft")}</Badge>
            <Badge>{t("status.draft")}</Badge>
          </div>
          <div className="grid grid-cols-1 gap-3 desktop:grid-cols-2">
            <Alert tone="info" title={t("status.infoTitle")}>
              {t("status.infoBody")}
            </Alert>
            <Alert tone="success" title={t("status.successTitle")}>
              {t("status.successBody")}
            </Alert>
            <Alert tone="warning" title={t("status.warningTitle")}>
              {t("status.warningBody")}
            </Alert>
            <Alert tone="danger" title={t("status.dangerTitle")}>
              {t("status.dangerBody")}
            </Alert>
          </div>
        </div>
      </GallerySection>

      <GallerySection id="lists" title={t("sections.lists")}>
        <List className="max-w-2xl">
          <ListItem
            icon={<Megaphone />}
            title={t("lists.announcementTitle")}
            description={t("lists.announcementBody")}
            href="/ui"
          />
          <ListItem
            icon={<CreditCard />}
            title={t("lists.paymentTitle")}
            description={<span className="num">{t("lists.paymentBody")}</span>}
            trailing={
              <Badge tone="success" icon={<CircleCheck />}>
                {t("status.active")}
              </Badge>
            }
          />
          <ListItem
            icon={<Languages />}
            title={t("lists.settingsTitle")}
            description={t("lists.settingsBody")}
            href="/ui"
          />
        </List>
      </GallerySection>
    </>
  );
}
