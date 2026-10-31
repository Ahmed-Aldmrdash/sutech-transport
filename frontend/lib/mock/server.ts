import type { RawResponse } from "@/lib/api/client";
import type { HttpMethod } from "@/lib/api/endpoint";
import { ErrorCode } from "@/lib/api/errors";
import { ALL_ENDPOINTS } from "@/lib/api/registry";
import { getDb, saveDb } from "./db";
import { MockError } from "./errors";
import type { Ctx } from "./helpers";
import { tx } from "./localized";
import { handlers } from "./handlers";
import { publishDue } from "./handlers/communication";
import { startSimulation } from "./simulation";

export interface MockRequest {
  method: HttpMethod;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  token: string | null;
  locale: string;
}

/* A little latency so loading states are real; none in unit tests. */
const LATENCY_MS = process.env.NODE_ENV === "test" ? { min: 0, max: 0 } : { min: 120, max: 320 };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Plays the FastAPI server in the browser: same paths, same role checks (401/403), same `{ code, message }` errors.
 * Each handler is keyed by "METHOD /path" exactly as in the endpoint definitions.
 */
export async function handleMockRequest(request: MockRequest): Promise<RawResponse> {
  startSimulation();
  if (LATENCY_MS.max) await wait(LATENCY_MS.min + Math.random() * (LATENCY_MS.max - LATENCY_MS.min));
  const key = `${request.method} ${request.path}`;
  const endpoint = ALL_ENDPOINTS.find((item) => `${item.method} ${item.path}` === key);
  const handler = handlers[key];
  if (!endpoint || !handler) return { status: 404, body: { code: ErrorCode.NotFound, message: key } };

  const db = getDb();
  const userId = request.token ? db.sessions[request.token] : undefined;
  const user = userId ? (db.users.find((row) => row.id === userId) ?? null) : null;

  if (endpoint.roles !== "public") {
    if (!user || !user.active) return { status: 401, body: { code: ErrorCode.Unauthorized, message: "Sign in again" } };
    if (!endpoint.roles.includes(user.role)) {
      return { status: 403, body: { code: ErrorCode.Forbidden, message: "Not allowed for this role" } };
    }
  }

  const ctx: Ctx = {
    db,
    user,
    params: request.params,
    query: request.query,
    body: request.body === undefined ? undefined : structuredClone(request.body),
    locale: request.locale,
    t: (value) => tx(value, request.locale),
  };

  try {
    publishDue(db);
    const result = handler(ctx);
    saveDb();
    return { status: 200, body: structuredClone(result ?? { ok: true }) };
  } catch (error) {
    if (error instanceof MockError) return { status: error.status, body: { code: error.code, message: error.message } };
    console.error(error);
    return { status: 500, body: { code: ErrorCode.Unknown, message: "Mock server error" } };
  }
}
