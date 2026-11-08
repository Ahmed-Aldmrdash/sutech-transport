"use client";

import { useSerwist } from "@serwist/turbopack/react";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Shown when a new version of the app has installed and is waiting. It takes over only when
 * the person taps "Update", so a page in use never loses its scripts halfway through a form.
 */
export function UpdateBanner() {
  const t = useTranslations("common");
  const { serwist } = useSerwist();
  const [isWaiting, setIsWaiting] = useState(false);
  /** Reload only for the update the person asked for, never on the very first install. */
  const updateRequested = useRef(false);

  useEffect(() => {
    if (!serwist) return;
    const onWaiting = () => setIsWaiting(true);
    const onControlling = () => {
      if (updateRequested.current) window.location.reload();
    };
    serwist.addEventListener("waiting", onWaiting);
    serwist.addEventListener("controlling", onControlling);
    return () => {
      serwist.removeEventListener("waiting", onWaiting);
      serwist.removeEventListener("controlling", onControlling);
    };
  }, [serwist]);

  if (!serwist || !isWaiting) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-toast flex justify-center p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]"
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-md border border-line bg-surface-raised p-3 shadow-lg">
        <RefreshCw aria-hidden="true" className="size-5 shrink-0 text-teal" />
        <p className="min-w-0 flex-1 text-body-sm font-bold text-ink-strong">{t("updateReady")}</p>
        <Button
          size="sm"
          onClick={() => {
            updateRequested.current = true;
            serwist.messageSkipWaiting();
          }}
        >
          {t("updateNow")}
        </Button>
      </div>
    </div>
  );
}
