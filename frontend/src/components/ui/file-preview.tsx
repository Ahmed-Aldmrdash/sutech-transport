"use client";

import { Download, ExternalLink, FileText, ZoomIn } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { buttonStyles } from "./button";
import { Dialog } from "./dialog";

interface FilePreviewProps {
  /** A short-lived link from the server. */
  url: string;
  name: string;
  contentType: string;
  /** What the picture shows, for screen readers. Defaults to the file name. */
  alt?: string;
}

/** A picture to open, or a PDF to open in a new tab. Data links can't open in a tab. */
function isImage(url: string, contentType: string): boolean {
  return contentType.startsWith("image/") || url.startsWith("data:image/");
}

/**
 * An uploaded file an office has to look at: a receipt, a document or a photo. A picture shows
 * as a thumbnail that opens full size (tap it again to see it at its real size); a PDF opens in
 * a new tab. Both can be downloaded.
 */
export function FilePreview({ url, name, contentType, alt }: FilePreviewProps) {
  const t = useTranslations("common.file");
  const [isOpen, setOpen] = useState(false);
  const [isZoomed, setZoomed] = useState(false);
  const canOpenInTab = !url.startsWith("data:");
  const download = (
    <a href={url} download={name} className={buttonStyles({ variant: "secondary", size: "sm" })}>
      <Download aria-hidden="true" className="size-4" />
      {t("download")}
    </a>
  );

  if (!isImage(url, contentType)) {
    return (
      <div className="flex flex-wrap items-center gap-2 font-normal">
        <FileText aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
        <bdi className="min-w-0 truncate" dir="ltr">
          {name}
        </bdi>
        {canOpenInTab ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            <ExternalLink aria-hidden="true" className="size-4" />
            {t("open")}
          </a>
        ) : null}
        {download}
      </div>
    );
  }

  const close = () => {
    setOpen(false);
    setZoomed(false);
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group mt-1 flex w-fit max-w-full flex-col gap-1 text-start font-normal focus-ring"
      >
        <span className="relative block overflow-hidden rounded-md border border-line bg-surface-alt">
          {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed link */}
          <img
            src={url}
            alt={alt ?? name}
            className="block h-40 w-auto max-w-full object-contain transition-opacity group-hover:opacity-90"
          />
          <span className="absolute end-2 bottom-2 inline-flex items-center gap-1 rounded-sm border border-line bg-surface-raised px-2 py-1 text-caption text-ink-strong shadow-sm">
            <ZoomIn aria-hidden="true" className="size-4" />
            {t("enlarge")}
          </span>
        </span>
        <bdi className="max-w-64 truncate text-caption text-ink-muted" dir="ltr">
          {name}
        </bdi>
      </button>
      <Dialog
        open={isOpen}
        onClose={close}
        title={<bdi dir="ltr">{name}</bdi>}
        className="desktop:max-w-4xl"
        footer={
          <>
            {canOpenInTab ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className={buttonStyles({ variant: "secondary", size: "sm" })}
              >
                <ExternalLink aria-hidden="true" className="size-4" />
                {t("openInTab")}
              </a>
            ) : null}
            {download}
          </>
        }
      >
        <button
          type="button"
          onClick={() => setZoomed((zoomed) => !zoomed)}
          aria-label={isZoomed ? t("fit") : t("actualSize")}
          className={cn(
            "block w-full overflow-auto rounded-md bg-surface-alt focus-ring",
            isZoomed ? "max-h-[65dvh] cursor-zoom-out" : "cursor-zoom-in",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed link */}
          <img
            src={url}
            alt={alt ?? name}
            className={cn(
              "mx-auto block",
              isZoomed ? "max-w-none" : "max-h-[65dvh] w-full object-contain",
            )}
          />
        </button>
      </Dialog>
    </>
  );
}
