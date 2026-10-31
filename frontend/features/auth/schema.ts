import { z } from "zod";
import { Id } from "@/lib/api/common";
import { ALL_ROLES } from "./roles";

export const RoleSchema = z.enum(ALL_ROLES as [string, ...string[]]);

export const Me = z.object({
  id: Id,
  role: RoleSchema,
  name: z.string(),
  /** Student ID (9 digits) for students, staff number for others. */
  identifier: z.string(),
  faculty: z.string().nullable(),
  level: z.string().nullable(),
  guardian_name: z.string().nullable(),
  /** Masked phone the OTP goes to, e.g. "010•••••907". */
  masked_phone: z.string().nullable(),
});
export type Me = z.infer<typeof Me>;

export const OtpRequest = z.object({ identifier: z.string().trim().min(3).max(64) });
export const OtpChallenge = z.object({
  masked_destination: z.string(),
  name_hint: z.string(),
  expires_in_seconds: z.number().int().positive(),
  attempts_left: z.number().int().nonnegative(),
  /** Only the mock server fills this, so the demo can be used without a phone. */
  demo_code: z.string().nullable(),
});
export type OtpChallenge = z.infer<typeof OtpChallenge>;

export const LoginRequest = z.object({
  identifier: z.string().trim().min(3).max(64),
  code: z.string().regex(/^\d{4,6}$/),
});
export const LoginResponse = z.object({ token: z.string().min(10), user: Me });
