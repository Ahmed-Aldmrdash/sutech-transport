import { expect, test, type Page } from "@playwright/test";
import { expectNoSidewaysScroll, signIn, switchTo } from "./helpers";

/**
 * Whole stories across roles, as they happen on a real morning: what one role does shows up
 * for the others. Seif (240100102) rides line 7; his father Hossam is 01000002001.
 */

const SEIF = "240100102";
const HOSSAM = "01000002001";

async function startTrip(page: Page) {
  const testDay = page.getByRole("button", { name: "Try a test day" });
  const start = page.getByRole("button", { name: "Start the outbound trip" });
  const onTheRoad = page.getByText(/On the road since/);
  await expect(testDay.or(start).or(onTheRoad)).toBeVisible();
  if (await testDay.isVisible()) await testDay.click();
  await expect(start.or(onTheRoad)).toBeVisible();
  if (await start.isVisible()) {
    await start.click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^Start( anyway)?$/ })
      .click();
    await expect(onTheRoad).toBeVisible();
  }
}

test("a morning on line 7: the driver scans Seif, his father and the office see it", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signIn(page, "DRV-1001");
  await page.waitForURL(/\/en\/driver$/);
  await startTrip(page);

  await page.goto("/en/driver/scan");
  await page.getByLabel("University ID").fill(SEIF);
  await page.getByRole("button", { name: "Mark on board" }).click();
  await expect(page.getByText("Seif Hossam Lotfy is on board")).toBeVisible();
  await expectNoSidewaysScroll(page);

  await page.goto("/en/driver/delay");
  await page.getByRole("button", { name: "15 min" }).click();
  await page.getByRole("button", { name: "Send the delay" }).click();
  await expect(page.getByText("Delay sent")).toBeVisible();

  // The father sees his son on the bus, and is told about the delay.
  await switchTo(page, HOSSAM);
  await page.waitForURL(/\/en\/parent$/);
  await page.goto("/en/parent/day");
  await expect(page.getByText(/On the bus since/).first()).toBeVisible();
  await page.goto("/en/parent/notifications");
  await expect(page.getByText(/15 min/).first()).toBeVisible();

  // The office sees him on the line's attendance and the bus on the live map.
  await switchTo(page, "TRN-1001");
  await page.waitForURL(/\/en\/admin$/);
  await page.goto("/en/admin/attendance?line=ln_07");
  await expect(page.getByText("Seif Hossam Lotfy").first()).toBeVisible();
  await page.goto("/en/admin/tracking");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/Line 7\b/).first()).toBeVisible();
  await page.getByRole("button", { name: /^Late/ }).click();
  await expect(page.getByText(/Line 7\b/).first()).toBeVisible();
  await expectNoSidewaysScroll(page);
});

test("a line change goes from the student to his father, then to the office", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, SEIF);
  await page.waitForURL(/\/en\/student$/);
  await page.goto("/en/student/requests/new/line-change");
  await page.getByLabel("New line").selectOption("ln_12");
  await page.getByLabel("Pickup or drop-off stop").selectOption("ln_12_s3");
  await page.getByLabel("Why do you need to change?").fill("We moved house near this line.");
  await page.getByLabel("Your mobile").fill("01000001002");
  await page.getByLabel("Guardian's mobile").fill(HOSSAM);
  await page.getByRole("button", { name: "Send request" }).click();
  await page.waitForURL(/\/en\/student\/requests\/req_/);
  await expect(page.getByText("Waiting for your guardian's approval")).toBeVisible();

  await switchTo(page, HOSSAM);
  await page.waitForURL(/\/en\/parent$/);
  await page.goto("/en/parent/approvals");
  await expect(page.getByText("Line change · Seif Hossam Lotfy")).toBeVisible();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Yes, approve" }).click();
  await expect(page.getByText(/You approved it on/)).toBeVisible();

  await switchTo(page, "TRN-1001");
  await page.waitForURL(/\/en\/admin$/);
  await page.goto("/en/admin/requests");
  await page
    .getByRole("link", { name: /Seif Hossam Lotfy/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved. The student was told.")).toBeVisible();

  await switchTo(page, SEIF);
  await page.waitForURL(/\/en\/student$/);
  await page.goto("/en/student/requests");
  await page.getByText("Line 7 → Line 12").first().click();
  await expect(page.getByText(/Approved/).first()).toBeVisible();

  // The decision is in the activity log.
  await switchTo(page, "ADM-1001");
  await page.waitForURL(/\/en\/admin$/);
  await page.goto("/en/admin/audit-log");
  await expect(page.getByRole("cell", { name: "Approved a request" }).first()).toBeVisible();
});
