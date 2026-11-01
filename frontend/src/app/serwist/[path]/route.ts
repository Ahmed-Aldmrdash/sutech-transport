import { createSerwistRoute } from "@serwist/turbopack";
import { spawnSync } from "node:child_process";

// A new revision on every build so the offline pages are re-cached after each deploy.
const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute(
  {
    swSrc: "src/sw/sw.ts",
    additionalPrecacheEntries: [
      { url: "/ar/offline", revision },
      { url: "/en/offline", revision },
    ],
    useNativeEsbuild: true,
  },
);
