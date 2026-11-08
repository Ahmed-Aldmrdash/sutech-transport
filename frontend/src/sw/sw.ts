import { defaultCache } from "@serwist/turbopack/worker";
import {
  NetworkOnly,
  Serwist,
  type PrecacheEntry,
  type RuntimeCaching,
  type SerwistGlobalConfig,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const OFFLINE_PAGE = { ar: "/ar/offline", en: "/en/offline" } as const;
/** Every FastAPI route lives under /api/v1 (same origin or the API host). */
const API_PATH_PREFIX = "/api/";
/** Sent by the page when the person taps "Update" on the new-version banner. */
const SKIP_WAITING_MESSAGE = "SKIP_WAITING";

/**
 * Answers from the API carry one person's data (their card, payments, children). They are
 * never cached: the cache key is only the URL, so a cached answer could be shown to the next
 * person who signs in on the same phone. This rule comes before Serwist's defaults, which
 * would otherwise keep them for up to a day.
 */
const apiNeverCached: RuntimeCaching = {
  matcher: ({ url }) => url.pathname.startsWith(API_PATH_PREFIX),
  handler: new NetworkOnly(),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // A new version waits until the person agrees to reload (see ServiceWorkerProvider), so a
  // page never loses its chunks halfway through a form.
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [apiNeverCached, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: OFFLINE_PAGE.en,
        matcher: ({ request }) =>
          request.destination === "document" && new URL(request.url).pathname.startsWith("/en"),
      },
      {
        url: OFFLINE_PAGE.ar,
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

self.addEventListener("message", (event) => {
  if ((event.data as { type?: unknown } | null)?.type === SKIP_WAITING_MESSAGE) {
    void self.skipWaiting();
  }
});

serwist.addEventListeners();
