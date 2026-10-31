import { call } from "@/lib/api/client";
import type { Endpoint } from "@/lib/api/endpoint";
import { writeToken } from "@/lib/session";
import { login, requestOtp } from "@/features/auth/api";
import { resetDb } from "./db";
import { DEMO_OTP } from "./handlers/auth";

export { call };
export type { Endpoint };

export function freshServer(): void {
  resetDb();
  writeToken(null);
}

/** Signs in through the real OTP flow and keeps the token for the next calls. */
export async function signInAs(identifier: string) {
  await requestOtp(identifier);
  const result = await login(identifier, DEMO_OTP);
  writeToken(result.token);
  return result.user;
}
