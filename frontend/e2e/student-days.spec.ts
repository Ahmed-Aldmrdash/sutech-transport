import { expect, test } from "@playwright/test";
import { expectNoSidewaysScroll, signIn, watchForErrors } from "./helpers";

const MARIAM = "240100102"; // Seif, active on line 7
const AHMED = "240100101"; // no booking

test.describe("not going today and my trips", () => {
  test("reports a day off, sees it, takes it back", async ({ page }) => {
    const errors = watchForErrors(page);
    await signIn(page, MARIAM);
    await page.waitForURL(/\/en\/student$/);
    await page.goto("/en/student/not-going-today");
    await expect(page.getByRole("heading", { name: "Not going today", level: 1 })).toBeVisible();
    await expect(page.getByText("Nothing reported. You're riding every day.")).toBeVisible();

    await page.getByLabel("No lectures").check();
    await page.getByRole("button", { name: "Report the day" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Yes, I'm not going" }).click();
    await expect(page.getByText("Reported", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "I'm riding after all" })).toBeVisible();
    await expectNoSidewaysScroll(page);

    await page.getByRole("button", { name: "I'm riding after all" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Yes, I'm riding" }).click();
    await expect(page.getByText("Nothing reported. You're riding every day.")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("my trips lists the term's trips with a summary and filter", async ({ page }) => {
    const errors = watchForErrors(page);
    await signIn(page, MARIAM);
    await page.waitForURL(/\/en\/student$/);
    await page.goto("/en/student/attendance");
    await expect(page.getByRole("heading", { name: "My trips", level: 1 })).toBeVisible();
    await expect(page.getByText(/Got on/).first()).toBeVisible();
    await page.getByRole("button", { name: "Left early" }).click();
    await expect(page.getByText(/Reason: Felt unwell/)).toBeVisible();
    await expectNoSidewaysScroll(page);
    expect(errors).toEqual([]);
  });

  test("students without an active subscription are told why", async ({ page }) => {
    await signIn(page, AHMED);
    await page.waitForURL(/\/en\/student$/);
    await page.goto("/en/student/not-going-today");
    await expect(page.getByText("For active subscribers")).toBeVisible();
    await page.goto("/en/student/attendance");
    await expect(page.getByText("No trips yet")).toBeVisible();
  });
});
