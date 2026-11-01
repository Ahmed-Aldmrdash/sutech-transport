import { describe, expect, it } from "vitest";
import { ALL_ROLES, OFFICE_ROLES, Role } from "@/lib/auth/roles";
import {
  MAX_PRIMARY_ITEMS,
  findActiveItem,
  navigationFor,
  primaryItems,
  roleHomeHref,
  type NavItemKey,
} from "./nav-config";

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
      for (const key of itemKeys(role)) expect(superKeys.has(key), `${role}:${key}`).toBe(true);
    }
  });

  it("keeps offices apart", () => {
    expect(itemKeys(Role.Finance)).toEqual(["payments", "refunds", "reports"]);
    expect(itemKeys(Role.Clinic)).toEqual(["emergencies", "clinic"]);
    expect(itemKeys(Role.BusCompany)).toEqual(["busCompany"]);
    expect(itemKeys(Role.Finance)).not.toContain("liveTracking");
  });

  it("gives the driver and the supervisor the same trip pages", () => {
    expect(itemKeys(Role.Driver)).toEqual(itemKeys(Role.Supervisor));
  });
});

describe("findActiveItem", () => {
  const navigation = navigationFor(Role.Transport);

  it("matches the home only on the exact path", () => {
    expect(findActiveItem(navigation, "/admin", "/admin")?.key).toBe("overview");
    expect(findActiveItem(navigation, "/admin", "/admin/lines")?.key).toBe("lines");
  });

  it("keeps the parent page active on nested pages", () => {
    expect(findActiveItem(navigation, "/admin", "/admin/lines/3/stops")?.key).toBe("lines");
  });

  it("returns nothing for paths outside the menu", () => {
    expect(findActiveItem(navigation, "/admin", "/admin/linesx")).toBeUndefined();
  });
});

describe("roleHomeHref", () => {
  it("uses the first page for offices without an overview", () => {
    expect(roleHomeHref(navigationFor(Role.Finance))).toBe("/admin/payments");
    expect(roleHomeHref(navigationFor(Role.Transport))).toBe("/admin");
    expect(roleHomeHref(navigationFor(Role.Student))).toBe("/student");
  });
});
