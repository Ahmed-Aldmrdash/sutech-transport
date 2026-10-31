/** Error codes the server may send in `{ code, message }`. The UI translates each code (messages: errors.*). */
export const ErrorCode = {
  Unauthorized: "UNAUTHORIZED",
  Forbidden: "FORBIDDEN",
  NotFound: "NOT_FOUND",
  Validation: "VALIDATION_ERROR",
  Network: "NETWORK_ERROR",
  BadResponse: "BAD_RESPONSE",
  InvalidOtp: "INVALID_OTP",
  OtpLocked: "OTP_LOCKED",
  UnknownIdentifier: "UNKNOWN_IDENTIFIER",
  AccountDisabled: "ACCOUNT_DISABLED",
  SeatUnavailable: "SEAT_UNAVAILABLE",
  BookingClosed: "BOOKING_CLOSED",
  AlreadySubscribed: "ALREADY_SUBSCRIBED",
  SubscriptionRequired: "SUBSCRIPTION_REQUIRED",
  ReservationExpired: "RESERVATION_EXPIRED",
  DuplicateReference: "DUPLICATE_REFERENCE",
  OpenRequestExists: "OPEN_REQUEST_EXISTS",
  InvalidState: "INVALID_STATE",
  TripNotStarted: "TRIP_NOT_STARTED",
  CardInvalid: "CARD_INVALID",
  CardExpired: "CARD_EXPIRED",
  WrongLine: "WRONG_LINE",
  AlreadyScanned: "ALREADY_SCANNED",
  SosAlreadyOpen: "SOS_ALREADY_OPEN",
  LastSuperAdmin: "LAST_SUPER_ADMIN",
  Unknown: "UNKNOWN",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const KNOWN = new Set<string>(Object.values(ErrorCode));

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = KNOWN.has(code) ? (code as ErrorCode) : ErrorCode.Unknown;
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError(0, ErrorCode.Unknown, error instanceof Error ? error.message : String(error));
}
