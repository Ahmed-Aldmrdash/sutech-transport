import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isDev = process.env.NODE_ENV === "development";
const DEV_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/** "https://{s}.tile.example.com/{z}/…" → "https://*.tile.example.com". */
function originOf(urlTemplate: string | undefined): string | null {
  if (!urlTemplate) return null;
  try {
    return new URL(urlTemplate.replace("{s}", "subdomain")).origin.replace("subdomain", "*");
  } catch {
    return null;
  }
}

/**
 * The page may only load scripts and styles from itself, talk to itself and the API, and show
 * map tiles from the configured provider. Inline scripts stay allowed: the pages are static
 * (no per-request nonce) and Next.js streams its data in inline scripts. The session can't be
 * stolen by a script anyway: it is an HttpOnly cookie (see src/lib/api/token-store.ts).
 */
function contentSecurityPolicy(): string {
  const api =
    process.env.NEXT_PUBLIC_API_MODE === "live"
      ? originOf(process.env.NEXT_PUBLIC_API_BASE_URL)
      : null;
  const tiles = originOf(process.env.NEXT_PUBLIC_MAP_TILE_URL || DEV_TILE_URL);
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...(tiles ? [tiles] : [])],
    "font-src": ["'self'"],
    // The tiles too: the service worker fetches them, and its fetches count as connections.
    "connect-src": [
      "'self'",
      ...(api ? [api] : []),
      ...(tiles ? [tiles] : []),
      ...(isDev ? ["ws:"] : []),
    ],
    "media-src": ["'self'", "blob:"],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
        ],
      },
    ];
  },
};

export default withSerwist(withNextIntl(nextConfig));
