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

/** "https://files.example.com, https://*.s3.amazonaws.com" → their origins, bad ones dropped. */
function originsOf(list: string | undefined): string[] {
  return (list ?? "")
    .split(",")
    .map((item) => originOf(item.trim()))
    .filter((origin): origin is string => origin !== null);
}

/**
 * The page may only load scripts and styles from itself, talk to itself and the API, and show
 * map tiles from the configured provider. Inline scripts stay allowed: the pages are static
 * (no per-request nonce) and Next.js streams its data in inline scripts. The session can't be
 * stolen by a script anyway: it is an HttpOnly cookie (see src/lib/api/token-store.ts).
 *
 * Uploaded files (receipts, documents, violation photos) come back as short-lived signed links
 * that the office pages show in an <img>. They are served by the API itself or by the file
 * store named in NEXT_PUBLIC_FILE_ORIGINS, so both may serve images.
 */
function contentSecurityPolicy(): string {
  const isLive = process.env.NEXT_PUBLIC_API_MODE === "live";
  const api = isLive ? originOf(process.env.NEXT_PUBLIC_API_BASE_URL) : null;
  const files = isLive ? originsOf(process.env.NEXT_PUBLIC_FILE_ORIGINS) : [];
  const tiles = originOf(process.env.NEXT_PUBLIC_MAP_TILE_URL || DEV_TILE_URL);
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      ...(api ? [api] : []),
      ...files,
      ...(tiles ? [tiles] : []),
    ],
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
