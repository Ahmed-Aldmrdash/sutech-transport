"use client";

import { useEffect } from "react";
import { listNotifications } from "../api";
import { unreadStore } from "../unread-store";

/** How often the badge checks for news until live events arrive (WebSocket, later phase). */
const POLL_MS = 60_000;

/** Keeps the unread badge current: on mount, every minute, and when the app comes back. */
export function NotificationsWatcher() {
  useEffect(() => {
    let controller = new AbortController();
    const check = () => {
      controller.abort();
      controller = new AbortController();
      listNotifications({ page_size: 1 }, { signal: controller.signal }).then(
        (page) => unreadStore.set(page.unread_count),
        () => undefined, // The badge just keeps its last value; the page shows errors.
      );
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    check();
    const timer = window.setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
