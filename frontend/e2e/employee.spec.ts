import { expect, test } from "@playwright/test";
import { atSchoolMorning, expectNoSidewaysScroll, signIn, watchForErrors } from "./helpers";

const DOCTOR = "EMP-2002";
const TRANSPORT = "TRN-1001";

test.describe("staff and faculty ride for free", () => {
  test("a doctor books line 5, gets the card, and has no payment page", async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchForErrors(page);
    await atSchoolMorning(page);
    await signIn(page, DOCTOR);
    await page.waitForURL(/\/en\/student$/);
    await expect(
      page.getByText("Riding is free for staff", { exact: false }).first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Payment" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Requests" })).toHaveCount(0);
    await expectNoSidewaysScroll(page);

    await page.goto("/en/student/lines/ln_05");
    await expect(page.getByText("Free", { exact: true }).first()).toBeVisible();
    await page.locator("label[for^='stop-ln_05_']").first().click();
    await page.getByRole("button", { name: "Book this seat" }).click();
    await expect(page.getByRole("dialog")).toContainText("Free for staff");
    await page.getByRole("dialog").getByRole("button", { name: "Yes, book it" }).click();
    await page.waitForURL(/\/en\/student$/);
    await expect(page.getByText("You're subscribed", { exact: true })).toBeVisible();

    await page.goto("/en/student/card");
    const pass = page.getByRole("article", { name: "Bus pass" });
    await expect(pass).toContainText("Staff ID");
    await expect(pass).toContainText("Staff member · Mathematics and Basic Sciences Department");
    await expectNoSidewaysScroll(page);

    await page.goto("/ar/student/payment");
    await page.waitForURL(/\/ar\/student$/);
    await expect(page.getByText("إنت مشترك", { exact: true })).toBeVisible();
    await expectNoSidewaysScroll(page);
    expect(errors).toEqual([]);
  });

  test("the office filters staff, who have no guardian", async ({ page }) => {
    const errors = watchForErrors(page);
    await atSchoolMorning(page);
    await signIn(page, TRANSPORT);
    await page.waitForURL(/\/en\/admin$/);
    await page.goto("/en/admin/students");
    await page
      .getByRole("group", { name: "Rider type" })
      .getByRole("button", { name: "Staff" })
      .click();
    await page.getByRole("link", { name: "Rania Sobhy Kamel" }).click();
    await expect(page.getByRole("heading", { name: "Rania Sobhy Kamel", level: 1 })).toBeVisible();
    await expect(page.getByText("Department", { exact: true })).toBeVisible();
    await expect(page.getByText("Guardian", { exact: true })).toHaveCount(0);
    await expectNoSidewaysScroll(page);
    expect(errors).toEqual([]);
  });
});
