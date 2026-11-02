"use client";

import { THEME_BOOT_SCRIPT } from "@/lib/theme/theme";

/**
 * Sets light or dark on <html> before the first paint, so the page never flashes the wrong theme.
 *
 * The script only needs to run once, from the server's HTML. When the root layout renders again
 * on the client (switching language swaps the whole `[locale]` tree), React would create a new
 * <script> that never runs and logs "Encountered a script tag". On the client it is therefore
 * marked as a data block (`text/plain`), which React leaves alone. `suppressHydrationWarning`
 * covers the `type` difference with the server's copy during hydration.
 */
export function ThemeBootScript() {
  const isClient = typeof window !== "undefined";
  return (
    <script
      suppressHydrationWarning
      type={isClient ? "text/plain" : undefined}
      dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }}
    />
  );
}
