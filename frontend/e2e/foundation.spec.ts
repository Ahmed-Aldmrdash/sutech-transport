import { expect, test } from "@playwright/test";
import { expectNoSidewaysScroll, isPhone, watchForErrors } from "./helpers";

test.describe("language and direction", () => {
  test("sends an Arabic phone to Arabic, right-to-left", async ({ browser }) => {
    const context = await browser.newContext({ locale: "ar-EG" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/ar$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("باصك في ميعاده.");
    await context.close();
  });

  test("sends an English browser to English", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });

  test("switches to English on the same page and back", async ({ page }) => {
    await page.goto("/ar/preview/student/card");
    await page.getByRole("button", { name: "Switch to English" }).click();
    await expect(page).toHaveURL(/\/en\/preview\/student\/card$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await page.getByRole("button", { name: "Switch to Arabic" }).click();
    await expect(page).toHaveURL(/\/ar\/preview\/student\/card$/);
  });
});

test.describe("theme", () => {
  test("follows the device, then remembers the user's choice", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/en/ui");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.getByRole("radio", { name: "Light" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});

test.describe("pages render cleanly", () => {
  const paths = [
    "/ar",
    "/en",
    "/ar/ui",
    "/en/ui",
    "/ar/preview/transport",
    "/en/preview/student",
    "/ar/preview/driver",
    "/ar/offline",
  ];

  for (const path of paths) {
    test(`${path} has no errors and no sideways scroll`, async ({ page }) => {
      const errors = watchForErrors(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectNoSidewaysScroll(page);
      expect(errors).toEqual([]);
    });
  }

  test("unknown pages show the localized not-found page", async ({ page }) => {
    const response = await page.goto("/en/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });
});

test.describe("app frame", () => {
  test("shows the role's menu and marks the current page", async ({ page }) => {
    await page.goto("/en/preview/transport/lines");
    if (isPhone(page)) {
      await page.getByRole("button", { name: "Open menu" }).click();
      const menu = page.getByRole("dialog", { name: "Menu" });
      await expect(menu.getByRole("link", { name: "Lines & booking" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await menu.getByRole("link", { name: "Students" }).click();
      await expect(menu).toBeHidden();
    } else {
      const sidebar = page.getByRole("complementary");
      await expect(sidebar.getByRole("link", { name: "Lines & booking" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await sidebar.getByRole("link", { name: "Students" }).click();
    }
    await expect(page).toHaveURL(/\/en\/preview\/transport\/students$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Students");
  });

  test("keeps offices apart: finance never sees tracking or users", async ({ page }) => {
    await page.goto("/en/preview/finance");
    if (isPhone(page)) await page.getByRole("button", { name: "Open menu" }).click();
    const nav = page.getByRole("navigation", { name: "Main navigation" }).filter({ visible: true });
    await expect(nav.getByRole("link", { name: "Payments" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Live tracking" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Users & permissions" })).toHaveCount(0);
  });

  test("phones get a bottom bar for the main pages", async ({ page }) => {
    test.skip(!isPhone(page), "phone only");
    await page.goto("/en/preview/student");
    const bar = page.getByRole("navigation", { name: "Quick navigation" });
    await expect(bar).toBeVisible();
    await bar.getByRole("link", { name: "Track my bus" }).click();
    await expect(page).toHaveURL(/\/en\/preview\/student\/tracking$/);
  });
});

test.describe("components", () => {
  test("dialog opens, traps the page and closes with Escape", async ({ page }) => {
    await page.goto("/en/ui");
    await page.getByRole("button", { name: "Open confirmation" }).click();
    const dialog = page.getByRole("dialog", { name: "Cancel your booking?" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("data layer answers from the mock server", async ({ page }) => {
    await page.goto("/en/ui");
    const section = page.locator("#api");
    await expect(section.getByText("mock-0.1.0")).toBeVisible();
    await section.getByRole("button", { name: "Simulate no connection" }).click();
    await expect(section.getByRole("heading", { name: "No connection" })).toBeVisible();
    await section.getByRole("button", { name: "Try again" }).click();
    await expect(section.getByText("mock-0.1.0")).toBeVisible();
  });
});
