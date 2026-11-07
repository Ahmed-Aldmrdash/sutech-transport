import type { z } from "zod";
import { ApiMode, appConfig } from "@/lib/config";
import {
  API_PREFIX,
  IDEMPOTENCY_HEADER,
  buildPath,
  buildQueryString,
  type Endpoint,
  type EndpointInput,
  type EndpointResponse,
  type ParsedInput,
} from "./endpoint";
import {
  ApiError,
  ClientErrorCode,
  HTTP_STATUS_NONE,
  HTTP_STATUS_UNAUTHORIZED,
  apiErrorBodySchema,
} from "./errors";
import type { MockResponse } from "./mock/mock-server";
import { tokenStore } from "./token-store";

const REQUEST_TIMEOUT_MS = 15_000;

export interface RequestOptions {
  signal?: AbortSignal;
  /**
   * For idempotent endpoints: reuse the same key when retrying the same action, so the server
   * runs it once. A new key is made for each call when none is given.
   */
  idempotencyKey?: string;
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * Called when the server answers 401 to a signed-in request (token expired or revoked).
 * The session registers itself here so any screen's request can end an expired session.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

/** The page language, sent as Accept-Language so server messages match the screen. */
function currentLanguage(): string | undefined {
  return typeof document === "undefined" ? undefined : document.documentElement.lang || undefined;
}

interface TransportRequest {
  endpoint: Endpoint;
  parsed: ParsedInput<Endpoint>;
  token: string | null;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

function parsePart(schema: z.ZodType | undefined, value: unknown, part: string): unknown {
  if (!schema) return undefined;
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError(
      HTTP_STATUS_NONE,
      ClientErrorCode.InvalidRequest,
      `Invalid request ${part}: ${result.error.message}`,
      { cause: result.error },
    );
  }
  return result.data;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ms <= 0) return resolve();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}

async function sendToMock({
  endpoint,
  parsed,
  token,
  idempotencyKey,
  signal,
}: TransportRequest): Promise<MockResponse> {
  const [{ handleMockRequest }] = await Promise.all([
    import("./mock/mock-server"),
    import("./mock/handlers"),
  ]);
  await sleep(appConfig.mockLatencyMs, signal);
  return handleMockRequest(endpoint, parsed, {
    token,
    language: currentLanguage() ?? "ar",
    idempotencyKey: idempotencyKey ?? null,
  });
}

async function sendToServer({
  endpoint,
  parsed,
  token,
  idempotencyKey,
  signal,
}: TransportRequest): Promise<MockResponse> {
  const url =
    appConfig.apiBaseUrl.replace(/\/$/, "") +
    API_PREFIX +
    buildPath(endpoint.path, parsed.params as Record<string, unknown> | undefined) +
    buildQueryString(parsed.query as Record<string, unknown> | undefined);

  const headers: Record<string, string> = { Accept: "application/json" };
  const language = currentLanguage();
  if (language) headers["Accept-Language"] = language;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (parsed.body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers[IDEMPOTENCY_HEADER] = idempotencyKey;

  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  try {
    const response = await fetch(url, {
      method: endpoint.method,
      headers,
      body: parsed.body === undefined ? undefined : JSON.stringify(parsed.body),
      signal: combined,
    });
    return { status: response.status, body: await response.text() };
  } catch (error) {
    if (signal?.aborted) throw error;
    const timedOut = timeout.aborted;
    throw new ApiError(
      HTTP_STATUS_NONE,
      timedOut ? ClientErrorCode.Timeout : ClientErrorCode.Network,
      timedOut ? "The server took too long to answer." : "Could not reach the server.",
      { cause: error },
    );
  }
}

function parseJson(text: string): unknown {
  if (text === "") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function toApiError(status: number, payload: unknown): ApiError {
  const parsed = apiErrorBodySchema.safeParse(payload);
  if (parsed.success) return new ApiError(status, parsed.data.code, parsed.data.message);
  return new ApiError(status, ClientErrorCode.Unknown, `Request failed with status ${status}`);
}

/**
 * The only way screens talk to the server. Validates the request, sends it to the mock server
 * or to FastAPI (NEXT_PUBLIC_API_MODE), and validates the answer against the endpoint's schema.
 * Throws ApiError on any failure.
 */
export async function callEndpoint<E extends Endpoint>(
  endpoint: E,
  input: EndpointInput<E>,
  options: RequestOptions = {},
): Promise<EndpointResponse<E>> {
  const raw = input as { params?: unknown; query?: unknown; body?: unknown };
  const parsed = {
    params: parsePart(endpoint.params, raw.params, "params"),
    query: parsePart(endpoint.query, raw.query, "query"),
    body: parsePart(endpoint.body, raw.body, "body"),
  } as ParsedInput<Endpoint>;

  const request: TransportRequest = {
    endpoint,
    parsed,
    token: tokenStore.get(),
    idempotencyKey: endpoint.idempotent
      ? (options.idempotencyKey ?? crypto.randomUUID())
      : undefined,
    signal: options.signal,
  };
  const { status, body } =
    appConfig.apiMode === ApiMode.Mock ? await sendToMock(request) : await sendToServer(request);

  const payload = parseJson(body);
  const isSuccess = status >= 200 && status < 300;
  if (!isSuccess) {
    if (status === HTTP_STATUS_UNAUTHORIZED && endpoint.access !== "public" && request.token) {
      unauthorizedHandler?.();
    }
    throw toApiError(status, payload);
  }

  const result = endpoint.response.safeParse(payload);
  if (!result.success) {
    throw new ApiError(
      status,
      ClientErrorCode.InvalidResponse,
      `Unexpected response for ${endpoint.id}: ${result.error.message}`,
      { cause: result.error },
    );
  }
  return result.data as EndpointResponse<E>;
}
