import {
  allMockAccounts,
  findMockAccount,
  maskPhone,
  saveStaffChange,
  staffChangeOf,
  type MockAccount,
} from "@/features/auth/mock-accounts";
import { requireMockOffice } from "@/features/auth/mock-token";
import { localized } from "@/features/lines/mock-builders";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import { Role } from "@/lib/auth/roles";
import {
  createStaffUserEndpoint,
  listAuditEndpoint,
  listStaffUsersEndpoint,
  updateStaffUserEndpoint,
} from "./api";
import { both, recordAudit, recordedAudit, type MockAuditEntry } from "./mock-log";
import {
  AUDIT_AREA_OF,
  AUDIT_PAGE_SIZE,
  AdminSystemErrorCode,
  AuditAction,
  STAFF_ID_PREFIX,
  STAFF_ROLES,
  type AuditEntry,
  type StaffRole,
  type StaffUser,
} from "./schema";

const HTTP = { NotFound: 404, Conflict: 409 };
const FIRST_NUMBER = 1000;
const HOUR = 60 * 60 * 1000;

const isStaff = (account: MockAccount): account is MockAccount & { user: { role: StaffRole } } =>
  (STAFF_ROLES as readonly Role[]).includes(account.user.role);

const staffAccounts = () => allMockAccounts().filter(isStaff);

function toStaffUser(account: MockAccount, meId: string, language: string): StaffUser {
  const { user } = account;
  const added = staffChangeOf(user.id)?.added;
  return {
    user_id: user.id,
    identifier: user.identifier,
    name: localized(language, user.name_ar ?? user.name, user.name),
    role: user.role as StaffRole,
    masked_phone: maskPhone(account.phone),
    active: !account.disabled,
    is_you: user.id === meId,
    added_at: added ? new Date(added.createdAt).toISOString() : null,
  };
}

const matches = (q: string | undefined, ...values: (string | null | undefined)[]) =>
  !q || values.some((value) => value?.toLowerCase().includes(q.toLowerCase()));

registerMock(listStaffUsersEndpoint, ({ query }, { token, language }) => {
  const me = requireMockOffice(token, []);
  const found = staffAccounts().filter(({ user }) =>
    matches(query.q, user.identifier, user.name, user.name_ar),
  );
  const counts: Record<string, number> = {};
  for (const { user } of found) counts[user.role] = (counts[user.role] ?? 0) + 1;
  return {
    items: found
      .filter(({ user }) => !query.role || user.role === query.role)
      .map((account) => toStaffUser(account, me.user.id, language)),
    counts,
  };
});

function nextIdentifier(role: StaffRole): string {
  const prefix = STAFF_ID_PREFIX[role];
  const taken = allMockAccounts()
    .map(({ user }) => user.identifier.match(new RegExp(`^${prefix}-(\\d+)$`))?.[1])
    .flatMap((value) => (value ? [Number(value)] : []));
  return `${prefix}-${Math.max(FIRST_NUMBER, ...taken) + 1}`;
}

registerMock(createStaffUserEndpoint, ({ body }, { token, language }) => {
  const me = requireMockOffice(token, []);
  if (allMockAccounts().some((account) => account.phone === body.phone)) {
    throw new MockHttpError(HTTP.Conflict, AdminSystemErrorCode.PhoneTaken, "Phone in use.");
  }
  const now = Date.now();
  const identifier = nextIdentifier(body.role);
  const name = body.name.trim();
  const nameAr = body.name_ar?.trim() || name;
  const id = `usr_staff_${now.toString(36)}`;
  const account: MockAccount = {
    user: {
      id,
      role: body.role,
      name,
      name_ar: nameAr,
      identifier,
      masked_phone: maskPhone(body.phone),
      phone: body.phone,
    },
    phone: body.phone,
  };
  saveStaffChange(id, { added: { ...account, createdAt: now } });
  recordAudit(me, AuditAction.UserAdded, staffTarget(account), null, now);
  const created = findMockAccount(identifier);
  if (!created) throw new Error("unreachable");
  return toStaffUser(created, me.user.id, language);
});

/** "FIN-1002 · نادية سمير", for the activity log. */
function staffTarget(account: MockAccount) {
  const { user } = account;
  return {
    ar: `${user.identifier} · ${user.name_ar ?? user.name}`,
    en: `${user.identifier} · ${user.name}`,
  };
}

const ROLE_WORD: Record<StaffRole, { ar: string; en: string }> = {
  [Role.Transport]: { ar: "إدارة النقل", en: "Transportation office" },
  [Role.Finance]: { ar: "الشؤون المالية", en: "Finance" },
  [Role.Clinic]: { ar: "العيادة", en: "Clinic" },
  [Role.StudentAffairs]: { ar: "شؤون الطلاب / الأمن", en: "Student affairs / Security" },
  [Role.SecretaryGeneral]: { ar: "الأمين العام", en: "Secretary General" },
  [Role.BusCompany]: { ar: "شركة أبو الهول", en: "Abu El Hol" },
  [Role.SuperAdmin]: { ar: "سوبر أدمن", en: "Super admin" },
};

registerMock(updateStaffUserEndpoint, ({ params, body }, { token, language }) => {
  const me = requireMockOffice(token, []);
  const account = staffAccounts().find(({ user }) => user.id === params.user_id);
  if (!account) {
    throw new MockHttpError(HTTP.NotFound, AdminSystemErrorCode.UserNotFound, "No such account.");
  }
  if (account.user.id === me.user.id) {
    throw new MockHttpError(
      HTTP.Conflict,
      AdminSystemErrorCode.CannotChangeSelf,
      "Ask another super admin.",
    );
  }
  const leavesSuperAdmins =
    account.user.role === Role.SuperAdmin &&
    !account.disabled &&
    (body.active === false || (body.role !== undefined && body.role !== Role.SuperAdmin));
  const otherAdmins = staffAccounts().filter(
    ({ user, disabled }) =>
      user.role === Role.SuperAdmin && !disabled && user.id !== account.user.id,
  );
  if (leavesSuperAdmins && otherAdmins.length === 0) {
    throw new MockHttpError(HTTP.Conflict, AdminSystemErrorCode.LastSuperAdmin, "Keep one.");
  }
  const now = Date.now();
  const change = { ...staffChangeOf(account.user.id) };
  if (body.active !== undefined && body.active === Boolean(account.disabled)) {
    change.disabled = !body.active;
    recordAudit(
      me,
      body.active ? AuditAction.UserActivated : AuditAction.UserStopped,
      staffTarget(account),
      null,
      now,
    );
  }
  if (body.role !== undefined && body.role !== account.user.role) {
    const from = ROLE_WORD[account.user.role as StaffRole];
    const to = ROLE_WORD[body.role];
    change.role = body.role;
    recordAudit(
      me,
      AuditAction.UserRoleChanged,
      staffTarget(account),
      { ar: `${from.ar} ← ${to.ar}`, en: `${from.en} → ${to.en}` },
      now,
    );
  }
  saveStaffChange(account.user.id, change);
  const updated = staffAccounts().find(({ user }) => user.id === account.user.id);
  if (!updated) throw new Error("unreachable");
  return toStaffUser(updated, me.user.id, language);
});

// ---------------------------------------------------------------------------------------------
// Activity log

/** What the offices did before this browser's demo started, so the log isn't empty. */
function seededAudit(now: number): MockAuditEntry[] {
  const seed = (
    hoursAgo: number,
    identifier: string,
    action: AuditAction,
    target: { ar: string; en: string },
    detail: { ar: string; en: string } | null = null,
  ): MockAuditEntry[] => {
    const actor = findMockAccount(identifier);
    if (!actor) return [];
    return [
      {
        id: `aud_seed_${hoursAgo}`,
        at: now - hoursAgo * HOUR,
        actorId: actor.user.id,
        actorIdentifier: actor.user.identifier,
        actorName: { ar: actor.user.name_ar ?? actor.user.name, en: actor.user.name },
        actorRole: actor.user.role,
        action,
        target,
        detail,
      },
    ];
  };
  return [
    ...seed(
      3,
      "FIN-1001",
      AuditAction.PaymentApproved,
      both("NBE-55120 · 240100107 · Malak Sherif Anwar"),
    ),
    ...seed(5, "STA-1001", AuditAction.ViolationOpened, {
      ar: "240100108 · أدهم مدحت صابر",
      en: "240100108 · Adham Medhat Saber",
    }),
    ...seed(26, "TRN-1001", AuditAction.AnnouncementPosted, {
      ar: "تغيير ميعاد خط 3 يوم الخميس",
      en: "Line 3 time change on Thursday",
    }),
    ...seed(
      30,
      "FIN-1001",
      AuditAction.PaymentRejected,
      both("NBE-55098 · 250100105 · Hazem Wael Fouad"),
      {
        ar: "الإيصال غير واضح، ارفع صورة أوضح.",
        en: "The slip is blurry; upload a clearer photo.",
      },
    ),
    ...seed(
      50,
      "TRN-1001",
      AuditAction.RequestApproved,
      both("REQ-2026-0004 · 240100109 · Farida Tarek Helmy"),
    ),
  ];
}

function toAuditEntry(entry: MockAuditEntry, language: string): AuditEntry {
  const text = (value: { ar: string; en: string }) => localized(language, value.ar, value.en);
  return {
    audit_id: entry.id,
    at: new Date(entry.at).toISOString(),
    actor: {
      name: text(entry.actorName),
      identifier: entry.actorIdentifier,
      role: entry.actorRole,
    },
    action: entry.action,
    area: AUDIT_AREA_OF[entry.action],
    target: text(entry.target),
    detail: entry.detail ? text(entry.detail) : null,
  };
}

registerMock(listAuditEndpoint, ({ query }, { token, language }) => {
  requireMockOffice(token, []);
  const now = Date.now();
  const page = query.page ?? 1;
  const all = [...recordedAudit(), ...seededAudit(now)]
    .filter((entry) => !query.area || AUDIT_AREA_OF[entry.action] === query.area)
    .filter((entry) =>
      matches(
        query.q,
        entry.actorIdentifier,
        entry.actorName.ar,
        entry.actorName.en,
        entry.target.ar,
        entry.target.en,
      ),
    )
    .sort((a, b) => b.at - a.at);
  return {
    items: all
      .slice((page - 1) * AUDIT_PAGE_SIZE, page * AUDIT_PAGE_SIZE)
      .map((entry) => toAuditEntry(entry, language)),
    total: all.length,
    page,
    page_size: AUDIT_PAGE_SIZE,
  };
});
