import { expect, test } from "@playwright/test";
import { failOnPageErrors, signIn, switchUser } from "./helpers";

test("the driver starts the trip and boards a student by ID", async ({ page }) => {
  const errors = failOnPageErrors(page);
  await signIn(page, "driver");
  await page.getByRole("button", { name: "ابدأ الرحلة" }).click();
  await expect(page.getByText("الرحلة شغالة")).toBeVisible();
  await page.goto("/ar/driver/scan");
  await page.getByLabel("أو اكتب الرقم الجامعي").fill("240102684");
  await page.getByRole("button", { name: "سجّل ركوب" }).click();
  await expect(page.getByText("عمر أحمد رمضان رمضان")).toBeVisible();
  expect(errors).toEqual([]);
});

test("the supervisor can't start or end the trip", async ({ page }) => {
  await signIn(page, "supervisor");
  await expect(page.getByText("السواق هو اللي بيبدأ وينهي الرحلة")).toBeVisible();
  await expect(page.getByRole("button", { name: "ابدأ الرحلة" })).toHaveCount(0);
});

test("the crew raises an SOS and the office acknowledges it", async ({ page }) => {
  await signIn(page, "driver");
  await page.getByRole("button", { name: "طوارئ SOS" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "ابعت البلاغ" }).click();
  await expect(page.getByText("البلاغ اتبعت")).toBeVisible();

  await switchUser(page, "transport");
  await page.goto("/ar/admin/sos");
  await page.getByRole("button", { name: "استلمت البلاغ" }).click();
  await expect(page.getByText("الإدارة شافت البلاغ").first()).toBeVisible();
});

test("a parent switches between children", async ({ page }) => {
  await signIn(page, "parent-240102791");
  await expect(page.getByRole("radio", { name: "أحمد" })).toBeVisible();
  await page.getByRole("radio", { name: "عمر" }).click();
  await expect(page.getByRole("heading", { name: /عمر أحمد/ })).toBeVisible();
});
