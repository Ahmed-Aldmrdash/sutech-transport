import type { z } from "zod";
import type { Role } from "@/features/auth/roles";

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/**
 * One backend endpoint: the single source for the client call, the mock server route
 * and the generated openapi.yaml (scripts/generate-openapi.ts).
 */
export interface Endpoint<TResponse extends z.ZodType = z.ZodType, TBody extends z.ZodType | undefined = z.ZodType | undefined> {
  method: HttpMethod;
  /** Path after /api/v1, with {param} placeholders. */
  path: string;
  summary: string;
  /** Roles the server must allow. Every other role gets 403. "public" means no token needed. */
  roles: readonly Role[] | "public";
  body?: TBody;
  query?: z.ZodObject;
  response: TResponse;
  /** Sends an Idempotency-Key header so a retried call runs once. */
  idempotent?: boolean;
  tag: string;
}

export function defineEndpoint<TResponse extends z.ZodType, TBody extends z.ZodType | undefined = undefined>(
  endpoint: Endpoint<TResponse, TBody>,
): Endpoint<TResponse, TBody> {
  return endpoint;
}

export function fillPath(path: string, params: Record<string, string> = {}): string {
  return path.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    if (value === undefined) throw new Error(`Missing path param "${key}" for ${path}`);
    return encodeURIComponent(value);
  });
}
