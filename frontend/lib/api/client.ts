import type { z } from "zod";
import { API_BASE_URL, API_PREFIX, isMockMode } from "@/lib/config";
import { readToken, writeToken } from "@/lib/session";
import { type Endpoint, fillPath } from "./endpoint";
import { ApiError, ErrorCode } from "./errors";

export interface CallOptions {
  params?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

export interface RawResponse {
  status: number;
  body: unknown;
}

export const SESSION_EXPIRED_EVENT = "sutech:session-expired";

function currentLocale(): string {
  if (typeof document === "undefined") return "ar";
  return document.documentElement.lang || "ar";
}

function queryString(query: CallOptions["query"]): string {
  if (!query) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

async function sendLive(endpoint: Endpoint, options: CallOptions, token: string | null): Promise<RawResponse> {
  const headers: Record<string, string> = { "Accept-Language": currentLocale(), Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (endpoint.idempotent) headers["Idempotency-Key"] = crypto.randomUUID();
  const url = `${API_BASE_URL}${API_PREFIX}${fillPath(endpoint.path, options.params)}${queryString(options.query)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: endpoint.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, ErrorCode.Network, "Network error");
  }
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function sendMock(endpoint: Endpoint, options: CallOptions, token: string | null): Promise<RawResponse> {
  const { handleMockRequest } = await import("@/lib/mock/server");
  return handleMockRequest({
    method: endpoint.method,
    path: endpoint.path,
    params: options.params ?? {},
    query: Object.fromEntries(
      Object.entries(options.query ?? {})
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([key, value]) => [key, String(value)]),
    ),
    body: options.body,
    token,
    locale: currentLocale(),
  });
}

/** Calls one endpoint, validates both sides with Zod, and turns `{ code, message }` into ApiError. */
export async function call<TResponse extends z.ZodType>(
  endpoint: Endpoint<TResponse, z.ZodType | undefined>,
  options: CallOptions = {},
): Promise<z.infer<TResponse>> {
  if (endpoint.body && options.body !== undefined) {
    const checked = endpoint.body.safeParse(options.body);
    if (!checked.success) throw new ApiError(400, ErrorCode.Validation, checked.error.message);
  }
  const token = endpoint.roles === "public" ? null : readToken();
  const raw = isMockMode
    ? await sendMock(endpoint as Endpoint, options, token)
    : await sendLive(endpoint as Endpoint, options, token);

  if (raw.status >= 400) {
    const error = (raw.body ?? {}) as { code?: string; message?: string };
    if (raw.status === 401) {
      writeToken(null);
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    throw new ApiError(raw.status, error.code ?? ErrorCode.Unknown, error.message ?? "");
  }
  const parsed = endpoint.response.safeParse(raw.body);
  if (!parsed.success) {
    console.error(`Response of ${endpoint.method} ${endpoint.path} does not match the contract`, parsed.error);
    throw new ApiError(raw.status, ErrorCode.BadResponse, parsed.error.message);
  }
  return parsed.data;
}
