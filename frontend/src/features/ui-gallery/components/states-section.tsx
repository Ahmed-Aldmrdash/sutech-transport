import { BellOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton, SkeletonLines } from "@/components/ui/skeleton";
import { GallerySection } from "./gallery-section";

export function StatesSection() {
  const t = useTranslations("gallery");
  return (
    <GallerySection id="states" title={t("sections.states")}>
      <div className="grid gap-4 desktop:grid-cols-3">
        <EmptyState
          icon={<BellOff />}
          title={t("states.emptyTitle")}
          description={t("states.emptyBody")}
          action={
            <ButtonLink href="/ui" variant="secondary">
              {t("states.emptyAction")}
            </ButtonLink>
          }
        />
        <ErrorState kind="network" />
        <Card aria-label={t("states.skeleton")}>
          <CardBody className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
            <SkeletonLines lines={4} />
          </CardBody>
        </Card>
      </div>
    </GallerySection>
  );
}
