import { expect, test } from "@playwright/test";
import { expectNoSidewaysScroll, requestCode, signIn, switchTo, watchForErrors } from "./helpers";

/** Phase 8: the super admin's users and permissions, and the activity log. */

test("the super admin adds an account, stops it, and sees both in the activity log", async ({
  page,
}) => {
  const errors = watchForErrors(page);
  await signIn(page, "ADM-1001");
  await page.waitForURL(/\/en\/admin$/);
  await page.goto("/en/admin/users");
  await expect(page.getByRole("heading", { level: 1, name: "Users & permissions" })).toBeVisible();
  await expectNoSidewaysScroll(page);

  await page.getByRole("button", { name: "Add account" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name in English").fill("Rania Adel");
  await dialog.getByLabel("Name in Arabic").fill("رانيا عادل");
  await dialog.getByLabel("Phone").fill("01000003120");
  await dialog.getByLabel("Office").selectOption({ label: "Finance" });
  await dialog.getByRole("button", { name: "Add account" }).click();
  await expect(page.getByText("Account added: FIN-1002.")).toBeVisible();

  const row = page.getByRole("row", { name: /Rania Adel/ });
  await row.getByRole("button", { name: "Stop" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Stop" }).click();
  await expect(page.getByText("Rania Adel is stopped.")).toBeVisible();
  await expect(row.getByText("Stopped")).toBeVisible();

  await page.goto("/en/admin/audit-log");
  await expect(page.getByRole("heading", { level: 1, name: "Activity log" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Stopped an account" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Added an account" })).toBeVisible();
  await page.getByRole("button", { name: "Payments" }).click();
  await expect(page.getByRole("cell", { name: "Added an account" })).toHaveCount(0);
  await expectNoSidewaysScroll(page);
  expect(errors).toEqual([]);

  // The stopped account can't get a code.
  await page.evaluate(() => localStorage.removeItem("sut.session"));
  await page.context().clearCookies();
  await page.goto("/en/login");
  await requestCode(page, "FIN-1002");
  await expect(page.getByText("This account is disabled.")).toBeVisible();
});

test("only the super admin opens the system pages", async ({ page }) => {
  await signIn(page, "TRN-1001");
  await page.waitForURL(/\/en\/admin$/);
  for (const path of ["/en/admin/users", "/en/admin/audit-log"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await switchTo(page, "ADM-1001");
  await page.waitForURL(/\/en\/admin$/);
  await page.goto("/en/admin/users");
  // Your own row has no actions.
  const mine = page.getByRole("row", { name: /Mariam Hassan/ });
  await expect(mine.getByText("You")).toBeVisible();
  await expect(mine.getByRole("button")).toHaveCount(0);
});
