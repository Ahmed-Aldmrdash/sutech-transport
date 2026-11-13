import { z } from "zod";
import { isoDateTime } from "@/lib/api/iso-datetime";
import { ALL_ROLES, type Role } from "@/lib/auth/roles";

/** Error codes for the two-step login, exactly as the contract names them. */
export const AuthErrorCode = {
  UnknownIdentifier: "UNKNOWN_IDENTIFIER",
  AccountDisabled: "ACCOUNT_DISABLED",
  InvalidOtp: "INVALID_OTP",
  OtpExpired: "OTP_EXPIRED",
  OtpLocked: "OTP_LOCKED",
  OtpRateLimited: "OTP_RATE_LIMITED",
} as const;
export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

const OTP_MIN_LENGTH = 4;
const OTP_MAX_LENGTH = 6;
export const IDENTIFIER_MAX_LENGTH = 64;

/** University ID (9 digits), staff ID or email, or a parent's phone number. */
const identifierSchema = z.string().trim().min(3).max(IDENTIFIER_MAX_LENGTH);
const otpCodeSchema = z.string().regex(new RegExp(`^\\d{${OTP_MIN_LENGTH},${OTP_MAX_LENGTH}}$`));

/** POST /auth/otp: step 1, ask the server to text a code to the account's registered phone. */
export const requestOtpBodySchema = z.object({ identifier: identifierSchema });

export const otpChallengeSchema = z.object({
  /** The registered phone, masked, e.g. "010•••••001". The code only ever goes there. */
  masked_destination: z.string(),
  /** First name only, to greet the user and confirm it's their account. */
  name_hint: z.string(),
  expires_in_seconds: z.number().int().positive(),
  attempts_left: z.number().int().nonnegative(),
  /** How many digits the code has (4 to 6), so the screen can submit as soon as it's complete. */
  code_length: z.number().int().min(OTP_MIN_LENGTH).max(OTP_MAX_LENGTH),
  /** Seconds before another code may be requested. */
  resend_after_seconds: z.number().int().nonnegative(),
  /** Test environment only. The production server must never send it. */
  demo_code: z.string().optional(),
});
export type OtpChallenge = z.infer<typeof otpChallengeSchema>;

/** POST /auth/login: step 2, the same identifier plus the code. */
export const loginBodySchema = z.object({ identifier: identifierSchema, code: otpCodeSchema });

const roleSchema = z.enum(ALL_ROLES as [Role, ...Role[]]);

/** The signed-in account. Optional fields only apply to some roles (students, parents). */
export const userSchema = z.object({
  id: z.string(),
  role: roleSchema,
  /** In English, as in the university's records. */
  name: z.string(),
  /** The same name in Arabic, shown when the app is in Arabic. null if the records lack it. */
  name_ar: z.string().nullable().optional(),
  identifier: z.string(),
  faculty: z.string().nullable().optional(),
  faculty_ar: z.string().nullable().optional(),
  level: z.number().int().nullable().optional(),
  guardian_name: z.string().nullable().optional(),
  guardian_name_ar: z.string().nullable().optional(),
  masked_phone: z.string().nullable().optional(),
  /** The user's own registered mobile, to prefill their own forms. Never another person's. */
  phone: z.string().nullable().optional(),
});
export type User = z.infer<typeof userSchema>;

/**
 * The server also sets the session cookie (HttpOnly, Secure, SameSite=Lax) on this answer.
 * The body never carries the token, so page scripts can't read or leak it.
 */
export const loginResponseSchema = z.object({
  /** When the session cookie stops working (ISO 8601, UTC). The app signs out at that moment. */
  expires_at: isoDateTime(),
  user: userSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

/** What the browser keeps between visits: the login answer (no token in it). */
export const storedSessionSchema = loginResponseSchema.extend({});
export type Session = LoginResponse;
