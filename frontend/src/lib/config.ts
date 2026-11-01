import { z } from "zod";

export const ApiMode = {
  Mock: "mock",
  Live: "live",
} as const;
export type ApiMode = (typeof ApiMode)[keyof typeof ApiMode];

const DEFAULT_MOCK_LATENCY_MS = 400;

const configSchema = z.object({
  apiMode: z.enum([ApiMode.Mock, ApiMode.Live]).default(ApiMode.Mock),
  apiBaseUrl: z.url().default("http://localhost:8000"),
  mockLatencyMs: z.coerce.number().int().min(0).max(10_000).default(DEFAULT_MOCK_LATENCY_MS),
});

export type AppConfig = z.infer<typeof configSchema>;

/**
 * Public runtime configuration, validated once at start-up. Each variable is read by its full
 * name so Next.js can inline it into the browser bundle. See .env.example.
 */
export const appConfig: AppConfig = configSchema.parse({
  apiMode: process.env.NEXT_PUBLIC_API_MODE || undefined,
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || undefined,
  mockLatencyMs: process.env.NEXT_PUBLIC_MOCK_LATENCY_MS || undefined,
});

export const isMockMode = appConfig.apiMode === ApiMode.Mock;
