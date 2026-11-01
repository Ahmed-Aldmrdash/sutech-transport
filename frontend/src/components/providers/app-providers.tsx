"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { ServiceWorkerProvider } from "./service-worker-provider";

/** Client-side providers shared by every page. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ServiceWorkerProvider>
        <ToastProvider>{children}</ToastProvider>
      </ServiceWorkerProvider>
    </ThemeProvider>
  );
}
