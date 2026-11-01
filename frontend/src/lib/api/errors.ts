import { z } from "zod";

/** The one error shape the server returns for every failed request: `{ code, message }`. */
export const apiErrorBodySchema = z.object({
  code: z.string().min(1),
  message: z.string(),
});
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

/** Codes produced by the client itself, not by the server. */
export const ClientErrorCode = {
  Network: "network_error",
  Timeout: "timeout",
  InvalidRequest: "invalid_request",
  InvalidResponse: "invalid_response",
  Unknown: "unknown_error",
} as const;

/** Codes the server is agreed to send (see the front end / back end contract). */
export const ServerErrorCode = {
  Unauthorized: "unauthorized",
  Forbidden: "forbidden",
  NotFound: "not_found",
  Conflict: "conflict",
  Validation: "validation_error",
  RateLimited: "rate_limited",
  Internal: "internal_error",
} as const;

export const HTTP_STATUS_NONE = 0;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  get isNetworkError(): boolean {
    return this.code === ClientErrorCode.Network || this.code === ClientErrorCode.Timeout;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
