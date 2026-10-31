"use client";

import { useLocale } from "next-intl";
import { formatTime } from "@/lib/time";
import type { Sos } from "../schema";

export function SosLog({ log }: { log: Sos["log"] }) {
  const locale = useLocale();
  return (
    <ol className="flex flex-col gap-2 border-s-2 border-line ps-4">
      {log.map((entry, index) => (
        <li key={index} className="text-[14px]">
          <time dateTime={entry.at} className="num me-2 text-ink-muted">
            {formatTime(entry.at, locale)}
          </time>
          <span className="text-ink-strong">{entry.text}</span>
          <span className="text-ink-muted"> · {entry.by}</span>
        </li>
      ))}
    </ol>
  );
}
