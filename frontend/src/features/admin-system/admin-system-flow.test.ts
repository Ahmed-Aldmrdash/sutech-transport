import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAnnouncement } from "@/features/announcements/api";
import { resetOfficeAnnouncementsMock } from "@/features/announcements/mock";
import { getMe, login, requestOtp } from "@/features/auth/api";
import { resetAuthMock } from "@/features/auth/mock";
import { resetStaffChanges } from "@/features/auth/mock-accounts";
import { AuthErrorCode } from "@/features/auth/schema";
import { ServerErrorCode, isApiError, type ApiError } from "@/lib/api/errors";
import { tokenStore } from "@/lib/api/token-store";
import { Role } from "@/lib/auth/roles";
import { createStaffUser, listAudit, listStaffUsers, updateStaffUser } from "./api";
import { resetAudit } from "./mock-log";
import { AdminSystemErrorCode, AuditAction, AuditArea } from "./schema";

async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  const caught: unknown = await promise.then(
    () => null,
    (error: unknown) => error,
  );
  if (!isApiError(caught)) throw new Error("expected an ApiError");
  return caught;
}

async function signIn(identifier: string) {
  const challenge = await requestOtp(identifier);
  await login(identifier, challenge.demo_code ?? "");
}

beforeEach(() => {
  resetAuthMock();
  resetStaffChanges();
  resetAudit();
  resetOfficeAnnouncementsMock();
});
afterEach(() => tokenStore.set(null));

describe("Users and the activity log (mock server)", () => {
  it("is for the super admin only", async () => {
    await signIn("TRN-1001");
    expect((await errorOf(listStaffUsers())).code).toBe(ServerErrorCode.Forbidden);
    expect((await errorOf(listAudit())).code).toBe(ServerErrorCode.Forbidden);
  });

  it("lists office accounts only, with the signed-in admin marked", async () => {
    await signIn("ADM-1001");
    const list = await listStaffUsers();
    const roles = new Set(list.items.map((item) => item.role));
    expect(roles.has(Role.Finance)).toBe(true);
    expect([...roles]).not.toContain(Role.Student);
    expect([...roles]).not.toContain(Role.Driver);
    expect(list.items.find((item) => item.is_you)?.identifier).toBe("ADM-1001");
    expect((await listStaffUsers({ role: Role.Finance })).items).toHaveLength(1);
    expect((await listStaffUsers({ q: "fin-" })).items[0]?.identifier).toBe("FIN-1001");
  });

  it("adds an account with the next ID, who can then sign in", async () => {
    await signIn("ADM-1001");
    const added = await createStaffUser({
      name: "Rania Adel",
      name_ar: "رانيا عادل",
      phone: "01000003120",
      role: Role.Finance,
    });
    expect(added.identifier).toBe("FIN-1002");
    expect(added.active).toBe(true);
    expect(
      (
        await errorOf(
          createStaffUser({
            name: "Someone",
            name_ar: null,
            phone: "01000003120",
            role: Role.Clinic,
          }),
        )
      ).code,
    ).toBe(AdminSystemErrorCode.PhoneTaken);
    await signIn("FIN-1002");
    expect((await getMe()).role).toBe(Role.Finance);
  });

  it("stops an account at its next request and refuses changing yourself", async () => {
    await signIn("ADM-1001");
    const finance = (await listStaffUsers({ role: Role.Finance })).items[0];
    const me = (await listStaffUsers({ role: Role.SuperAdmin })).items[0];
    if (!finance || !me) throw new Error("seed missing");
    expect((await errorOf(updateStaffUser(me.user_id, { active: false }))).code).toBe(
      AdminSystemErrorCode.CannotChangeSelf,
    );

    await signIn("FIN-1001");
    const financeToken = tokenStore.get();
    await signIn("ADM-1001");
    expect((await updateStaffUser(finance.user_id, { active: false })).active).toBe(false);

    tokenStore.set(financeToken);
    expect((await errorOf(getMe())).status).toBe(401);
    expect((await errorOf(requestOtp("FIN-1001"))).code).toBe(AuthErrorCode.AccountDisabled);
  });

  it("moves an account to another office", async () => {
    await signIn("ADM-1001");
    const clinic = (await listStaffUsers({ role: Role.Clinic })).items[0];
    if (!clinic) throw new Error("seed missing");
    expect((await updateStaffUser(clinic.user_id, { role: Role.StudentAffairs })).role).toBe(
      Role.StudentAffairs,
    );
    await signIn("CLN-1001");
    expect((await getMe()).role).toBe(Role.StudentAffairs);
  });

  it("logs every office decision, newest first, filterable by area", async () => {
    await signIn("TRN-1001");
    await createAnnouncement({
      kind: "official",
      line_id: null,
      title_ar: "تجربة",
      title_en: "Trial notice",
      body_ar: "نص تجريبي للإعلان",
      body_en: "A trial announcement body",
    });
    await signIn("ADM-1001");
    const clinic = (await listStaffUsers({ role: Role.Clinic })).items[0];
    if (!clinic) throw new Error("seed missing");
    await updateStaffUser(clinic.user_id, { active: false });

    const log = await listAudit();
    expect(log.items[0]?.action).toBe(AuditAction.UserStopped);
    expect(log.items[0]?.actor.identifier).toBe("ADM-1001");
    expect(log.items[1]?.action).toBe(AuditAction.AnnouncementPosted);
    expect(log.items[1]?.target).toBe("تجربة");
    const users = await listAudit({ area: AuditArea.Users });
    expect(users.items.every((item) => item.area === AuditArea.Users)).toBe(true);
    expect((await listAudit({ q: "trial" })).total).toBe(1);
  });
});
