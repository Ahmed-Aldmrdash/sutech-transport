"use client";

import { SerwistProvider } from "@serwist/turbopack/react";
import { useEffect, type ReactNode } from "react";

export const SERVICE_WORKER_URL = "/serwist/sw.js";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Registers the PWA service worker in production builds only.
 *
 * A worker registered by an earlier `npm run start` on the same address stays installed and
 * keeps answering every request under `npm run dev`: each page and chunk goes through it, it
 * re-fetches its own script (rebuilt on every check in dev) and fails while a page compiles.
 * That made the dev site very slow, so in development any such worker is removed with its caches.
 */
export function ServiceWorkerProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (IS_PRODUCTION || !("serviceWorker" in navigator)) return;
    void removeServiceWorkers();
  }, []);

  return (
    <SerwistProvider swUrl={SERVICE_WORKER_URL} disable={!IS_PRODUCTION}>
      {children}
    </SerwistProvider>
  );
}

async function removeServiceWorkers() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  if (registrations.length === 0) return;
  await Promise.all(registrations.map((registration) => registration.unregister()));
  if ("caches" in window) {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
  }
}
