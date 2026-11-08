import { createSerwistRoute } from "@serwist/turbopack";
import { spawnSync } from "node:child_process";

// A new revision on every build so the offline pages are re-cached after each deploy.
const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute(
  {
    swSrc: "src/sw/sw.ts",
    // Precache only what every visitor needs offline: styles, fonts and icons (a few hundred
    // KB). Scripts are cached the first time a page uses them, so a student's phone never
    // downloads the office, mock or developer pages up front.
    globPatterns: [".next/static/**/*.{css,woff2}", "public/icons/**/*"],
    additionalPrecacheEntries: [
      { url: "/ar/offline", revision },
      { url: "/en/offline", revision },
    ],
    useNativeEsbuild: true,
    // No source map in the published worker.
    esbuildOptions: { sourcemap: false },
  },
);
