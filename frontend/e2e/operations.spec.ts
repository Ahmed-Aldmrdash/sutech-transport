import { expect, test } from "@playwright/test";
import { expectNoSidewaysScroll, isPhone, signIn, watchForErrors } from "./helpers";

/** Phase 8: the Transportation office's operations pages. */

test.beforeEach(async ({ page }) => {
  await signIn(page, "TRN-1001");
  await page.waitForURL(/\/en\/admin$/);
});

test("the overview shows what waits for the office", async ({ page }) => {
  const errors = watchForErrors(page);
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Waiting for you" })).toBeVisible();
  await page.getByRole("link", { name: /New requests/ }).click();
  await page.waitForURL(/\/en\/admin\/requests$/);
  await expectNoSidewaysScroll(page);
  expect(errors).toEqual([]);
});

test("a line opens its students, and a student their guardian", async ({ page }) => {
  const errors = watchForErrors(page);
  if (isPhone(page)) await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .getByRole("link", { name: /^Lines$/ })
    .filter({ visible: true })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Lines" })).toBeVisible();
  await page.getByRole("link", { name: "Line 7 · El Shorouk" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Line 7 · El Shorouk" })).toBeVisible();
  await page.getByLabel(/Find a student/).fill("240100102");
  await page.getByRole("link", { name: "Seif Hossam Lotfy" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Seif Hossam Lotfy" })).toBeVisible();
  await expect(page.getByText("Uses the app")).toBeVisible();
  await expect(page.getByRole("link", { name: /Call Hossam Lotfy/ })).toBeVisible();
  await expectNoSidewaysScroll(page);
  expect(errors).toEqual([]);
});

test("students are found by university ID", async ({ page }) => {
  await page.goto("/en/admin/students");
  await page.getByLabel("Search").fill("240100101");
  await expect(page.getByRole("link", { name: "Ziad Tamer Nour" })).toBeVisible();
  await expect(page.getByText("No seat")).toBeVisible();
  await expectNoSidewaysScroll(page);
});

test("attendance, the live map and the buses open", async ({ page }) => {
  const errors = watchForErrors(page);
  await page.goto("/en/admin/attendance?line=ln_07");
  await expect(page.getByRole("heading", { level: 1, name: "Attendance" })).toBeVisible();
  await expect(page.getByLabel("Line")).toHaveValue("ln_07");
  await page.goto("/en/admin/tracking");
  await expect(page.getByRole("region", { name: "Map of every bus on the road" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Line 7 · El Shorouk/ })).toBeVisible();
  await page.getByRole("button", { name: /Line 7 · El Shorouk/ }).click();
  await expect(page.getByRole("link", { name: "Who rode" })).toBeVisible();
  await page.goto("/en/admin/buses");
  await expect(page.getByRole("heading", { level: 1, name: "Buses & drivers" })).toBeVisible();
  await expectNoSidewaysScroll(page);
  expect(errors).toEqual([]);
});
