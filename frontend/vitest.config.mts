import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "jsdom",
    // One jsdom per worker instead of one per test file (it was two thirds of the run time).
    pool: "vmThreads",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    env: {
      NEXT_PUBLIC_API_MODE: "mock",
      NEXT_PUBLIC_MOCK_LATENCY_MS: "0",
    },
    css: false,
    // next-intl imports "next/navigation" without an extension; let Vite resolve it.
    server: { deps: { inline: ["next-intl"] } },
  },
});
