import type { Endpoint, EndpointResponse, ParsedInput } from "../endpoint";
import { ServerErrorCode, type ApiErrorBody } from "../errors";

/** Thrown inside a mock handler to answer with an HTTP error, exactly like FastAPI would. */
export class MockHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "MockHttpError";
    this.status = status;
    this.code = code;
  }
}

interface MockContext {
  /** The bearer token the request carried, or null. */
  token: string | null;
  /** The page language ("ar" or "en"), as the real server reads it from Accept-Language. */
  language: string;
  /** The Idempotency-Key header, for endpoints that send one. */
  idempotencyKey?: string | null;
}

type MockHandler<E extends Endpoint> = (
  input: ParsedInput<E>,
  context: MockContext,
) => EndpointResponse<E> | Promise<EndpointResponse<E>>;

export interface MockResponse {
  status: number;
  /** JSON text, as it would arrive over the network. */
  body: string;
}

const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const HTTP_INTERNAL = 500;

const handlers = new Map<string, MockHandler<Endpoint>>();

/** Registers the mock answer for one endpoint. Each feature does this in its own mock.ts. */
export function registerMock<E extends Endpoint>(endpoint: E, handler: MockHandler<E>): void {
  handlers.set(endpoint.id, handler as unknown as MockHandler<Endpoint>);
}

/** Whether a handler is registered for this endpoint id (for the mock routing test). */
export function isMocked(endpointId: string): boolean {
  return handlers.has(endpointId);
}

function errorResponse(status: number, body: ApiErrorBody): MockResponse {
  return { status, body: JSON.stringify(body) };
}

/**
 * Answers a request in the browser. Input arrives already validated by the client, and the
 * answer goes back as JSON text so the client parses and validates it like a real response.
 */
export async function handleMockRequest<E extends Endpoint>(
  endpoint: E,
  input: ParsedInput<E>,
  context: MockContext,
): Promise<MockResponse> {
  const handler = handlers.get(endpoint.id);
  if (!handler) {
    return errorResponse(HTTP_NOT_FOUND, {
      code: ServerErrorCode.NotFound,
      message: `No mock registered for ${endpoint.method} ${endpoint.path}`,
    });
  }
  try {
    const result = await handler(input as ParsedInput<Endpoint>, context);
    return { status: HTTP_OK, body: JSON.stringify(result) };
  } catch (error) {
    if (error instanceof MockHttpError) {
      return errorResponse(error.status, { code: error.code, message: error.message });
    }
    return errorResponse(HTTP_INTERNAL, {
      code: ServerErrorCode.Internal,
      message: error instanceof Error ? error.message : "Mock handler failed",
    });
  }
}
