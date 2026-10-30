import { ErrorCode } from "@/lib/api/errors";

export class MockError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string = code,
  ) {
    super(message);
  }
}

export const notFound = () => new MockError(404, ErrorCode.NotFound);
export const forbidden = () => new MockError(403, ErrorCode.Forbidden);
export const invalidState = (message = "invalid state") => new MockError(409, ErrorCode.InvalidState, message);
