import { describe, expect, it } from "vitest";
import { ALL_ROLES, Role } from "@/lib/auth/roles";
import {
  MAX_PRIMARY_ITEMS,
  findActiveItem,
  navigationFor,
  primaryItems,
  readyItems,
  roleHomeHref,
  soonItems,
  type NavItemKey,
} from "./nav-config";

const OFFICE_ROLES: readonly Role[] = [
  Role.SuperAdmin,
  Role.Transport,
  Role.Finance,
  Role.Clinic,
  Role.StudentAffairs,
  Role.SecretaryGeneral,
  Role.BusCompany,
];

function itemKeys(role: Role): NavItemKey[] {
  return navigationFor(role).groups.flatMap((group) => group.items.map((item) => item.key));
}

describe("role navigation", () => {
  it("gives every role at least one page and at most four bottom-bar items", () => {
    for (const role of ALL_ROLES) {
      expect(itemKeys(role).length, role).toBeGreaterThan(0);
      expect(primaryItems(navigationFor(role)).length, role).toBeLessThanOrEqual(MAX_PRIMARY_ITEMS);
    }
  });

  it("shows users & permissions and the activity log to the super admin only", () => {
    for (const role of ALL_ROLES) {
      const keys = itemKeys(role);
      const isSuper = role === Role.SuperAdmin;
      expect(keys.includes("users"), role).toBe(isSuper);
      expect(keys.includes("auditLog"), role).toBe(isSuper);
    }
  });

  it("gives the super admin every office page", () => {
    const superKeys = new Set(itemKeys(Role.SuperAdmin));
    for (const role of OFFICE_ROLES) {
      for (const key of itemKeys(role)) {
        // "home" is the welcome page of an office with no built page; the super admin has some.
        if (key !== "home") expect(superKeys.has(key), `${role}:${key}`).toBe(true);
      }
    }
  });

  it("keeps offices apart", () => {
    expect(itemKeys(Role.Finance)).toEqual(["payments", "refunds", "complaints", "reports"]);
    expect(itemKeys(Role.StudentAffairs)).toEqual(["violations"]);
    expect(itemKeys(Role.Clinic)).toEqual(["emergencies", "clinic"]);
    expect(itemKeys(Role.BusCompany)).toEqual(["busCompany"]);
    expect(itemKeys(Role.SecretaryGeneral)).toEqual(["reports", "secretaryGeneral"]);
    expect(itemKeys(Role.Transport)).toContain("events");
    expect(itemKeys(Role.Finance)).not.toContain("events");
    expect(itemKeys(Role.Finance)).not.toContain("liveTracking");
  });

  it("gives the driver and the supervisor the same trip pages", () => {
    expect(itemKeys(Role.Driver)).toEqual(itemKeys(Role.Supervisor));
  });
});

describe("findActiveItem", () => {
  const navigation = navigationFor(Role.Student);

  it("matches the home only on the exact path", () => {
    expect(findActiveItem(navigation, "/student", "/student")?.key).toBe("home");
    expect(findActiveItem(navigation, "/student", "/student/lines")?.key).toBe("lines");
  });

  it("keeps the parent page active on nested pages", () => {
    expect(findActiveItem(navigation, "/student", "/student/lines/ln_07")?.key).toBe("lines");
  });

  it("returns nothing for paths outside the menu", () => {
    expect(findActiveItem(navigation, "/student", "/student/linesx")).toBeUndefined();
  });

  it("never matches a page that isn't built yet", () => {
    expect(findActiveItem(navigation, "/student", "/student/assistant")).toBeUndefined();
    const office = navigationFor(Role.Transport);
    expect(findActiveItem(office, "/admin", "/admin/lines")).toBeUndefined();
    expect(findActiveItem(office, "/admin", "/admin/emergencies/sos_1")?.key).toBe("emergencies");
  });
});

describe("coming soon pages", () => {
  it("keeps unbuilt pages out of the bottom bar and the role's home", () => {
    for (const role of ALL_ROLES) {
      const navigation = navigationFor(role);
      expect(readyItems(navigation).length, role).toBeGreaterThan(0);
      expect(
        primaryItems(navigation).every((item) => !item.soon),
        role,
      ).toBe(true);
    }
  });

  it("lists what each office will get", () => {
    expect(soonItems(navigationFor(Role.Finance))).toEqual([]);
    expect(soonItems(navigationFor(Role.SecretaryGeneral))).toEqual([]);
    expect(soonItems(navigationFor(Role.BusCompany))).toEqual([]);
    expect(soonItems(navigationFor(Role.Clinic))).toEqual([]);
  });
});

describe("roleHomeHref", () => {
  it("lands each role on its first built page", () => {
    expect(roleHomeHref(navigationFor(Role.Finance))).toBe("/admin/payments");
    expect(roleHomeHref(navigationFor(Role.StudentAffairs))).toBe("/admin/violations");
    expect(roleHomeHref(navigationFor(Role.SecretaryGeneral))).toBe("/admin/secretary-general");
    expect(roleHomeHref(navigationFor(Role.BusCompany))).toBe("/admin/bus-company");
    expect(roleHomeHref(navigationFor(Role.Transport))).toBe("/admin/emergencies");
    expect(roleHomeHref(navigationFor(Role.Clinic))).toBe("/admin/emergencies");
    expect(roleHomeHref(navigationFor(Role.Student))).toBe("/student");
  });
});
