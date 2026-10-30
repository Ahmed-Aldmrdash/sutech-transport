import { ErrorCode } from "@/lib/api/errors";
import { getDb } from "../db";
import { MockError } from "../errors";
import { body, me } from "../helpers";
import { userView } from "../views";
import type { Handlers } from "./types";

export const DEMO_OTP = "4821";
const MAX_ATTEMPTS = 3;

function findAccount(identifier: string) {
  const key = identifier.trim().toLowerCase();
  const user = getDb().users.find((row) => row.identifier.toLowerCase() === key);
  if (!user) throw new MockError(404, ErrorCode.UnknownIdentifier);
  if (!user.active) throw new MockError(403, ErrorCode.AccountDisabled);
  return user;
}

export const authHandlers: Handlers = {
  "POST /auth/otp": (ctx) => {
    const { identifier } = body<{ identifier: string }>(ctx);
    const user = findAccount(identifier);
    ctx.db.otp[user.id] = { code: DEMO_OTP, attempts: 0 };
    const [first = ""] = user.name.split(" ");
    return {
      masked_destination: user.masked_phone ?? "",
      name_hint: first,
      expires_in_seconds: 300,
      attempts_left: MAX_ATTEMPTS,
      demo_code: DEMO_OTP,
    };
  },
  "POST /auth/login": (ctx) => {
    const { identifier, code } = body<{ identifier: string; code: string }>(ctx);
    const user = findAccount(identifier);
    const challenge = ctx.db.otp[user.id];
    if (!challenge) throw new MockError(400, ErrorCode.InvalidOtp);
    if (challenge.attempts >= MAX_ATTEMPTS) throw new MockError(429, ErrorCode.OtpLocked);
    if (challenge.code !== code) {
      challenge.attempts += 1;
      throw new MockError(challenge.attempts >= MAX_ATTEMPTS ? 429 : 400, challenge.attempts >= MAX_ATTEMPTS ? ErrorCode.OtpLocked : ErrorCode.InvalidOtp);
    }
    delete ctx.db.otp[user.id];
    const token = `mock.${user.id}.${crypto.randomUUID()}`;
    ctx.db.sessions[token] = user.id;
    return { token, user: userView(user, ctx) };
  },
  "GET /me": (ctx) => userView(me(ctx), ctx),
  "POST /auth/logout": (ctx) => {
    const user = me(ctx);
    for (const [token, userId] of Object.entries(ctx.db.sessions)) if (userId === user.id) delete ctx.db.sessions[token];
    return { ok: true };
  },
};
