import type { z } from "zod";
import type { Role } from "@/lib/auth/roles";

export const HttpMethod = {
  Get: "GET",
  Post: "POST",
  Put: "PUT",
  Patch: "PATCH",
  Delete: "DELETE",
} as const;
export type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];

/** Every path is relative to this prefix on the FastAPI server. */
export const API_PREFIX = "/api/v1";

export const IDEMPOTENCY_HEADER = "Idempotency-Key";

type Schema = z.ZodType;

/**
 * One request the front end makes, described once. The same definition drives the real HTTP
 * call, the mock server, response validation and the generated openapi.json for the Back End team.
 */
export interface Endpoint<
  TParams extends Schema | undefined = Schema | undefined,
  TQuery extends Schema | undefined = Schema | undefined,
  TBody extends Schema | undefined = Schema | undefined,
  TResponse extends Schema = Schema,
> {
  /** Stable id, e.g. "system.getHealth". Used as the OpenAPI operationId. */
  id: string;
  method: HttpMethod;
  /** Path under /api/v1 with `{name}` placeholders, e.g. "/lines/{line_id}". */
  path: `/${string}`;
  summary: string;
  /** OpenAPI tag; usually the feature name. */
  tag: string;
  /** Roles allowed to call it. `"public"` means no token is needed. */
  access: readonly Role[] | "public";
  /**
   * The request changes something (a booking, a payment, an SOS), so it carries an
   * `Idempotency-Key` header: the server runs it once even if it arrives twice.
   */
  idempotent?: boolean;
  params?: TParams;
  query?: TQuery;
  body?: TBody;
  response: TResponse;
}

export function defineEndpoint<
  TParams extends Schema | undefined = undefined,
  TQuery extends Schema | undefined = undefined,
  TBody extends Schema | undefined = undefined,
  TResponse extends Schema = Schema,
>(
  endpoint: Endpoint<TParams, TQuery, TBody, TResponse>,
): Endpoint<TParams, TQuery, TBody, TResponse> {
  return endpoint;
}

type Field<TKey extends string, TSchema> = TSchema extends Schema
  ? { [K in TKey]: z.input<TSchema> }
  : { [K in TKey]?: never };

/** What a caller passes: params, query and body, each required only if the endpoint has one. */
export type EndpointInput<E extends Endpoint> =
  E extends Endpoint<infer TParams, infer TQuery, infer TBody, Schema>
    ? Field<"params", TParams> & Field<"query", TQuery> & Field<"body", TBody>
    : never;

type Parsed<TSchema> = TSchema extends Schema ? z.output<TSchema> : undefined;

/** Validated request parts, as a mock handler receives them. */
export type ParsedInput<E extends Endpoint> =
  E extends Endpoint<infer TParams, infer TQuery, infer TBody, Schema>
    ? { params: Parsed<TParams>; query: Parsed<TQuery>; body: Parsed<TBody> }
    : never;

export type EndpointResponse<E extends Endpoint> = z.output<E["response"]>;

export function buildPath(template: string, params: Record<string, unknown> | undefined): string {
  return template.replace(/\{([a-z0-9_]+)\}/gi, (_, name: string) => {
    const value = params?.[name];
    if (value === undefined || value === null) {
      throw new Error(`Missing path parameter "${name}" for ${template}`);
    }
    return encodeURIComponent(String(value));
  });
}

export function buildQueryString(query: Record<string, unknown> | undefined): string {
  if (!query) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) value.forEach((item) => search.append(key, String(item)));
    else search.append(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}
