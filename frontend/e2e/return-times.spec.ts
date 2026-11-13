import { expect, test } from "@playwright/test";
import { expectNoSidewaysScroll, signIn, switchTo, watchForErrors } from "./helpers";

/** Every bus reaches campus at 8:30 and leaves at 4:30 PM; the office can change a line. */

test("transport changes line 7's return time and Seif sees it on his line", async ({ page }) => {
  const errors = watchForErrors(page);
  await signIn(page, "TRN-1001");
  await page.waitForURL(/\/en\/admin$/);
  await page.goto("/en/admin/return-times");
  await expect(page.getByRole("heading", { level: 1, name: "Return times" })).toBeVisible();
  await expect(page.getByText("8:30 AM").first()).toBeVisible();
  await expect(page.getByText("4:30 PM").first()).toBeVisible();
  await expectNoSidewaysScroll(page);

  await page.getByRole("button", { name: "Change line 7" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Leaves campus at").fill("15:00");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved. Return time: 3:00 PM.")).toBeVisible();
  await expect(page.getByText(/Changed by Karim Fathy/)).toBeVisible();

  await switchTo(page, "240100102");
  await page.waitForURL(/\/en\/student$/);
  await page.goto("/en/student/lines/ln_07");
  await expect(page.getByText("3:00 PM").first()).toBeVisible();
  await expect(page.getByText("8:30 AM").first()).toBeVisible();
  expect(errors).toEqual([]);
});
