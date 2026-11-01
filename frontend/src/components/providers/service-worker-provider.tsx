"use client";

import { SerwistProvider } from "@serwist/turbopack/react";
import type { ReactNode } from "react";

export const SERVICE_WORKER_URL = "/serwist/sw.js";

/** Registers the PWA service worker in production builds only (it would cache dev assets). */
export function ServiceWorkerProvider({ children }: { children: ReactNode }) {
  return (
    <SerwistProvider swUrl={SERVICE_WORKER_URL} disable={process.env.NODE_ENV !== "production"}>
      {children}
    </SerwistProvider>
  );
}
