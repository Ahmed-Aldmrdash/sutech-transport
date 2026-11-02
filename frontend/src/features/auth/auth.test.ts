import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ApiError, isApiError } from "@/lib/api/errors";
import { tokenStore } from "@/lib/api/token-store";
import { Role } from "@/lib/auth/roles";
import { canOpen, homePathFor, landingPathFor, loginHref, safeNextPath } from "./access";
import { getMe, login, logout, requestOtp } from "./api";
import { loginErrorKey } from "./auth-errors";
import { normalizeIdentifier, sanitizeCode } from "./identifier";
import { MOCK_OTP_RULES, resetAuthMock } from "./mock";
import { MOCK_OTP_LENGTH } from "./mock-accounts";
import { AuthErrorCode } from "./schema";

async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  const caught: unknown = await promise.then(
    () => null,
    (error: unknown) => error,
  );
  if (!isApiError(caught)) throw new Error("expected an ApiError");
  return caught;
}

describe("identifier input", () => {
  it("accepts Arabic digits, spaces and dashes", () => {
    expect(normalizeIdentifier(" ٢٤٠ ١٠٢ ٧٩١ ")).toBe("240102791");
    expect(normalizeIdentifier("010-9876-5432")).toBe("01098765432");
    expect(normalizeIdentifier("۰۱۰۹۸۷۶۵۴۳۲")).toBe("01098765432");
  });

  it("keeps emails lower case and staff IDs upper case", () => {
    expect(normalizeIdentifier("Karim@SUT.edu.eg")).toBe("karim@sut.edu.eg");
    expect(normalizeIdentifier("drv-1001")).toBe("DRV-1001");
  });

  it("keeps only the digits of a code, up to its length", () => {
    expect(sanitizeCode("4 8-2١٩", 4)).toBe("4821");
  });
});

describe("role access", () => {
  it("sends each role to its own home", () => {
    expect(homePathFor(Role.Student)).toBe("/student");
    expect(homePathFor(Role.Parent)).toBe("/parent");
    expect(homePathFor(Role.Driver)).toBe("/driver");
    expect(homePathFor(Role.Supervisor)).toBe("/driver");
    expect(homePathFor(Role.Transport)).toBe("/admin");
    expect(homePathFor(Role.SuperAdmin)).toBe("/admin");
    expect(homePathFor(Role.Finance)).toBe("/admin/payments");
    expect(homePathFor(Role.Clinic)).toBe("/admin/emergencies");
    expect(homePathFor(Role.BusCompany)).toBe("/admin/bus-company");
  });

  it("keeps roles out of each other's pages", () => {
    expect(canOpen(Role.Student, "/student/card")).toBe(true);
    expect(canOpen(Role.Student, "/student/lines/l1")).toBe(true);
    expect(canOpen(Role.Student, "/parent")).toBe(false);
    expect(canOpen(Role.Student, "/admin")).toBe(false);
    expect(canOpen(Role.Student, "/student/not-a-page")).toBe(false);
    expect(canOpen(Role.Parent, "/student")).toBe(false);
    expect(canOpen(Role.Driver, "/admin/payments")).toBe(false);
  });

  it("keeps offices apart inside /admin", () => {
    expect(canOpen(Role.Finance, "/admin/payments")).toBe(true);
    expect(canOpen(Role.Finance, "/admin")).toBe(false);
    expect(canOpen(Role.Finance, "/admin/tracking")).toBe(false);
    expect(canOpen(Role.Transport, "/admin/users")).toBe(false);
    expect(canOpen(Role.Clinic, "/admin/payments")).toBe(false);
    expect(canOpen(Role.SuperAdmin, "/admin/users")).toBe(true);
    expect(canOpen(Role.SuperAdmin, "/admin/payments")).toBe(true);
    expect(canOpen(Role.SuperAdmin, "/student")).toBe(false);
  });

  it("returns to the page asked for only if the role may open it", () => {
    expect(landingPathFor(Role.Student, "/student/card")).toBe("/student/card");
    expect(landingPathFor(Role.Student, "/admin/users")).toBe("/student");
    expect(landingPathFor(Role.Finance, null)).toBe("/admin/payments");
  });

  it("never follows a link off the site", () => {
    expect(safeNextPath("//evil.example")).toBeNull();
    expect(safeNextPath("https://evil.example")).toBeNull();
    expect(safeNextPath("/\\evil.example")).toBeNull();
    expect(safeNextPath("/student")).toBe("/student");
  });

  it("builds the sign-in link", () => {
    expect(loginHref()).toBe("/login");
    expect(loginHref({ next: "/student/card", reason: "expired" })).toBe(
      "/login?next=%2Fstudent%2Fcard&reason=expired",
    );
  });
});

describe("two-step login (mock server)", () => {
  beforeEach(() => resetAuthMock());
  afterEach(() => {
    tokenStore.clear();
    vi.useRealTimers();
  });

  it("sends a code, signs in and knows who you are", async () => {
    const challenge = await requestOtp("240102791");
    expect(challenge).toMatchObject({
      masked_destination: "010•••••907",
      name_hint: "أحمد",
      attempts_left: MOCK_OTP_RULES.attempts,
      code_length: MOCK_OTP_LENGTH,
    });
    const session = await login("240102791", challenge.demo_code ?? "");
    expect(session.user.role).toBe(Role.Student);
    expect(Date.parse(session.expires_at)).toBeGreaterThan(Date.now());

    tokenStore.set(session.token);
    expect((await getMe()).id).toBe(session.user.id);
    await logout();
    expect((await errorOf(getMe())).status).toBe(401);
  });

  it("rejects unknown and disabled accounts", async () => {
    const unknown = await errorOf(requestOtp("999999999"));
    expect(unknown.code).toBe(AuthErrorCode.UnknownIdentifier);
    expect(loginErrorKey(unknown)).toBe("unknownIdentifier");
    expect((await errorOf(requestOtp("240100000"))).code).toBe(AuthErrorCode.AccountDisabled);
  });

  it("allows one code per minute", async () => {
    await requestOtp("DRV-1001");
    expect((await errorOf(requestOtp("DRV-1001"))).code).toBe(AuthErrorCode.OtpRateLimited);
  });

  it("locks the account after three wrong codes", async () => {
    await requestOtp("FIN-1001");
    expect((await errorOf(login("FIN-1001", "0000"))).code).toBe(AuthErrorCode.InvalidOtp);
    expect((await errorOf(login("FIN-1001", "0000"))).code).toBe(AuthErrorCode.InvalidOtp);
    expect((await errorOf(login("FIN-1001", "0000"))).code).toBe(AuthErrorCode.OtpLocked);
    expect((await errorOf(requestOtp("FIN-1001"))).code).toBe(AuthErrorCode.OtpLocked);
  });

  it("uses a code only once", async () => {
    const { demo_code: code = "" } = await requestOtp("ADM-1001");
    await login("ADM-1001", code);
    expect((await errorOf(login("ADM-1001", code))).code).toBe(AuthErrorCode.InvalidOtp);
  });

  it("a new code replaces the old one", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const first = await requestOtp("CLN-1001");
    vi.setSystemTime(Date.now() + MOCK_OTP_RULES.resendAfterSeconds * 1000);
    const second = await requestOtp("CLN-1001");
    if (first.demo_code !== second.demo_code) {
      expect((await errorOf(login("CLN-1001", first.demo_code ?? ""))).code).toBe(
        AuthErrorCode.InvalidOtp,
      );
    }
    expect((await login("CLN-1001", second.demo_code ?? "")).user.role).toBe(Role.Clinic);
  });

  it("refuses an expired code", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { demo_code: code = "" } = await requestOtp("SUP-1001");
    vi.setSystemTime(Date.now() + (MOCK_OTP_RULES.expiresInSeconds + 1) * 1000);
    expect((await errorOf(login("SUP-1001", code))).code).toBe(AuthErrorCode.OtpExpired);
  });
});
