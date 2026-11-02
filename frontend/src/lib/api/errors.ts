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

/** Codes the server is agreed to send, in UPPER_SNAKE_CASE like the contract's examples. */
export const ServerErrorCode = {
  Unauthorized: "UNAUTHORIZED",
  Forbidden: "FORBIDDEN",
  NotFound: "NOT_FOUND",
  Conflict: "CONFLICT",
  Validation: "VALIDATION_ERROR",
  RateLimited: "RATE_LIMITED",
  Internal: "INTERNAL_ERROR",
} as const;

export const HTTP_STATUS_NONE = 0;
export const HTTP_STATUS_UNAUTHORIZED = 401;

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

/**
 * Which message a screen shows for a failed action: the server's code when the screen has its
 * own words for it, else "network" or "generic".
 */
export function errorMessageKey<TCode extends string>(
  error: unknown,
  knownCodes: readonly TCode[],
): TCode | "network" | "generic" {
  if (!isApiError(error)) return "generic";
  if (error.isNetworkError) return "network";
  return (knownCodes as readonly string[]).includes(error.code) ? (error.code as TCode) : "generic";
}
