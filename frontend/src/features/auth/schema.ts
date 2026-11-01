import { z } from "zod";
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

export const OTP_MIN_LENGTH = 4;
export const OTP_MAX_LENGTH = 6;
export const IDENTIFIER_MAX_LENGTH = 64;

/** University ID (9 digits), staff ID or email, or a parent's phone number. */
export const identifierSchema = z.string().trim().min(3).max(IDENTIFIER_MAX_LENGTH);
export const otpCodeSchema = z
  .string()
  .regex(new RegExp(`^\\d{${OTP_MIN_LENGTH},${OTP_MAX_LENGTH}}$`));

/** POST /auth/otp: step 1, ask the server to text a code to the account's registered phone. */
export const requestOtpBodySchema = z.object({ identifier: identifierSchema });

export const otpChallengeSchema = z.object({
  /** The registered phone, masked, e.g. "010•••••907". The code only ever goes there. */
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
  name: z.string(),
  identifier: z.string(),
  faculty: z.string().nullable().optional(),
  level: z.number().int().nullable().optional(),
  guardian_name: z.string().nullable().optional(),
  masked_phone: z.string().nullable().optional(),
});
export type User = z.infer<typeof userSchema>;

export const loginResponseSchema = z.object({
  token: z.string().min(1),
  /** When the token stops working (ISO 8601, UTC). The app signs out at that moment. */
  expires_at: z.iso.datetime(),
  user: userSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

/** What the browser keeps between visits. Same shape as the login response. */
export const storedSessionSchema = loginResponseSchema;
export type Session = LoginResponse;
