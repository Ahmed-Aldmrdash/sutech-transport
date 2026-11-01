import { isApiError } from "@/lib/api/errors";
import { AuthErrorCode } from "./schema";

/** Keys under `login.errors` in the translation files. */
export type LoginErrorKey =
  | "unknownIdentifier"
  | "accountDisabled"
  | "invalidOtp"
  | "otpExpired"
  | "otpLocked"
  | "otpRateLimited"
  | "network"
  | "generic";

const KEY_BY_CODE: Record<string, LoginErrorKey> = {
  [AuthErrorCode.UnknownIdentifier]: "unknownIdentifier",
  [AuthErrorCode.AccountDisabled]: "accountDisabled",
  [AuthErrorCode.InvalidOtp]: "invalidOtp",
  [AuthErrorCode.OtpExpired]: "otpExpired",
  [AuthErrorCode.OtpLocked]: "otpLocked",
  [AuthErrorCode.OtpRateLimited]: "otpRateLimited",
};

/** The server sends a code; the screen shows our own words for it, in the user's language. */
export function loginErrorKey(error: unknown): LoginErrorKey {
  if (!isApiError(error)) return "generic";
  if (error.isNetworkError) return "network";
  return KEY_BY_CODE[error.code] ?? "generic";
}
