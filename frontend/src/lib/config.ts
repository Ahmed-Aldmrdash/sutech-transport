import { z } from "zod";

export const ApiMode = {
  Mock: "mock",
  Live: "live",
} as const;
export type ApiMode = (typeof ApiMode)[keyof typeof ApiMode];

const DEFAULT_MOCK_LATENCY_MS = 150;

/**
 * OpenStreetMap's own tile servers: fine for development and the mock demo, but their usage
 * policy rules out a production app. A live build must name its own provider.
 */
const DEV_MAP_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEV_MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const IS_PRODUCTION_BUILD = process.env.NODE_ENV === "production";

const configSchema = z
  .object({
    apiMode: z.enum([ApiMode.Mock, ApiMode.Live]),
    apiBaseUrl: z.url().default("http://localhost:8000"),
    mockLatencyMs: z.coerce.number().int().min(0).max(10_000).default(DEFAULT_MOCK_LATENCY_MS),
    /** The developer pages (/ui, /preview). Off unless asked for, and never in live mode. */
    devPages: z.boolean(),
    mapTileUrl: z.url().optional(),
    mapAttribution: z.string().optional(),
  })
  .superRefine((config, ctx) => {
    if (config.apiMode === ApiMode.Live && IS_PRODUCTION_BUILD && !config.mapTileUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["mapTileUrl"],
        message:
          "Set NEXT_PUBLIC_MAP_TILE_URL to the university's tile provider for a live build.",
      });
    }
  })
  .transform((config) => ({
    ...config,
    devPages: config.devPages && config.apiMode === ApiMode.Mock,
    mapTileUrl: config.mapTileUrl ?? DEV_MAP_TILE_URL,
    mapAttribution: config.mapAttribution ?? DEV_MAP_ATTRIBUTION,
  }));

type AppConfig = z.infer<typeof configSchema>;

/**
 * A production build has to say which server it talks to: a forgotten NEXT_PUBLIC_API_MODE
 * used to fall back to the mock server, with its demo accounts. Development and tests still
 * default to the mock.
 */
function apiModeFromEnv(): string | undefined {
  const value = process.env.NEXT_PUBLIC_API_MODE || undefined;
  if (value === undefined && IS_PRODUCTION_BUILD) {
    throw new Error(
      'NEXT_PUBLIC_API_MODE is not set. Use "live" with NEXT_PUBLIC_API_BASE_URL, or "mock" for the demo (see .env.example).',
    );
  }
  return value ?? ApiMode.Mock;
}

function devPagesFromEnv(): boolean {
  const value = process.env.NEXT_PUBLIC_DEV_PAGES;
  if (value === undefined || value === "") return !IS_PRODUCTION_BUILD;
  return value === "true";
}

/**
 * Public runtime configuration, validated once at start-up. Each variable is read by its full
 * name so Next.js can inline it into the browser bundle. See .env.example.
 */
export const appConfig: AppConfig = configSchema.parse({
  apiMode: apiModeFromEnv(),
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || undefined,
  mockLatencyMs: process.env.NEXT_PUBLIC_MOCK_LATENCY_MS || undefined,
  devPages: devPagesFromEnv(),
  mapTileUrl: process.env.NEXT_PUBLIC_MAP_TILE_URL || undefined,
  mapAttribution: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || undefined,
});

export const isMockMode = appConfig.apiMode === ApiMode.Mock;
export const areDevPagesOn = appConfig.devPages;
