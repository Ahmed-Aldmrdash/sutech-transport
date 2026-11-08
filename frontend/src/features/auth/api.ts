import { z } from "zod";
import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { ALL_ROLES } from "@/lib/auth/roles";
import { isMockMode } from "@/lib/config";
import {
  loginBodySchema,
  loginResponseSchema,
  otpChallengeSchema,
  requestOtpBodySchema,
  userSchema,
  type LoginResponse,
  type OtpChallenge,
  type User,
} from "./schema";

const TAG = "auth";

export const requestOtpEndpoint = defineEndpoint({
  id: "auth.requestOtp",
  method: HttpMethod.Post,
  path: "/auth/otp",
  summary:
    "Step 1 of sign-in for every role: texts a one-time code to the account's registered phone. " +
    "Errors: UNKNOWN_IDENTIFIER (404), ACCOUNT_DISABLED (403), OTP_LOCKED (429), OTP_RATE_LIMITED (429).",
  tag: TAG,
  access: "public",
  body: requestOtpBodySchema,
  response: otpChallengeSchema,
});

export const loginEndpoint = defineEndpoint({
  id: "auth.login",
  method: HttpMethod.Post,
  path: "/auth/login",
  summary:
    "Step 2: the same identifier plus the code. Returns a bearer token that carries the role. " +
    "Errors: INVALID_OTP (400), OTP_EXPIRED (400), OTP_LOCKED (429).",
  tag: TAG,
  access: "public",
  body: loginBodySchema,
  response: loginResponseSchema,
});

export const logoutEndpoint = defineEndpoint({
  id: "auth.logout",
  method: HttpMethod.Post,
  path: "/auth/logout",
  summary: "Revokes the caller's token.",
  tag: TAG,
  access: ALL_ROLES,
  response: z.object({ ok: z.literal(true) }),
});

export const getMeEndpoint = defineEndpoint({
  id: "auth.getMe",
  method: HttpMethod.Get,
  path: "/me",
  summary: "The signed-in account and its role. 401 when the token has expired or was revoked.",
  tag: TAG,
  access: ALL_ROLES,
  response: userSchema,
});

/**
 * Step 1. A `demo_code` is only ever kept in mock mode: if a real server sent one by mistake
 * (say, a staging build), showing it would let anyone sign in as anyone.
 */
export async function requestOtp(
  identifier: string,
  options?: RequestOptions,
): Promise<OtpChallenge> {
  const challenge = await callEndpoint(requestOtpEndpoint, { body: { identifier } }, options);
  if (isMockMode) return challenge;
  return { ...challenge, demo_code: undefined };
}

export function login(
  identifier: string,
  code: string,
  options?: RequestOptions,
): Promise<LoginResponse> {
  return callEndpoint(loginEndpoint, { body: { identifier, code } }, options);
}

export async function logout(options?: RequestOptions): Promise<void> {
  await callEndpoint(logoutEndpoint, {}, options);
}

export function getMe(options?: RequestOptions): Promise<User> {
  return callEndpoint(getMeEndpoint, {}, options);
}

export const authEndpoints = [requestOtpEndpoint, loginEndpoint, logoutEndpoint, getMeEndpoint];
