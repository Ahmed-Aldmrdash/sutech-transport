import { expect, test, type Page } from "@playwright/test";
import { expectNoSidewaysScroll, isPhone, signIn, switchTo } from "./helpers";

const DRIVER = "DRV-1001"; // Kamal Ezzat, line 7
const TRANSPORT = "TRN-1001"; // Karim Fathy, Transportation office
const CLINIC = "CLN-1001"; // Dr. Salma Nabil
const TILE_HOST = "tile.openstreetmap.org";

/** Map tiles need the internet; a tile that fails to load is not an app error. */
function watchForAppErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.location().url.includes(TILE_HOST)) {
      errors.push(message.text());
    }
  });
  return errors;
}

async function driverRaisesSos(page: Page, type: RegExp = /Bus problem/) {
  await signIn(page, DRIVER);
  await page.waitForURL(/\/en\/driver$/);
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
  await page.goto("/en/driver/sos");
  await page.getByRole("button", { name: type }).click();
  await page.getByRole("button", { name: "Send SOS now" }).click();
  await expect(page.getByText(/Waiting for the Transportation office/)).toBeVisible();
}

test.describe("emergencies", () => {
  test("the office takes an SOS, sends a spare bus and closes it; the driver sees it", async ({
    page,
  }) => {
    const errors = watchForAppErrors(page);
    await driverRaisesSos(page);

    await switchTo(page, TRANSPORT);
    await page.waitForURL(/\/en\/admin$/);
    // The overview shows the open alert first; its desk lists it at the top.
    await expect(page.getByRole("link", { name: /Open emergencies/ })).toContainText("1");
    await page.goto("/en/admin/emergencies");
    await page
      .getByRole("link", { name: /Bus problem Not taken Line 7/ })
      .first()
      .click();

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Line 7");
    await page.getByRole("button", { name: "Take it" }).click();
    await expect(page.getByText(/Taken by Karim Fathy/)).toBeVisible();
    await expectNoSidewaysScroll(page);

    await page.getByRole("button", { name: "Send another bus or driver" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/Driver: Sayed Abdelhamid/)).toBeVisible();
    await dialog.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText("Sent another bus or driver")).toBeVisible();

    await page.getByRole("button", { name: "Close the alert" }).click();
    await page.getByRole("dialog").getByLabel("What was done").fill("Spare bus took over.");
    await page.getByRole("dialog").getByRole("button", { name: "Close the alert" }).click();
    await expect(page.getByText(/Closed by Karim Fathy/)).toBeVisible();

    await switchTo(page, DRIVER);
    await page.waitForURL(/\/en\/driver$/);
    // The spare driver took over: the first driver is told and can't run the trip any more.
    await expect(page.getByText("The office handed your bus to another driver")).toBeVisible();
    await expect(page.getByText(/Sayed Abdelhamid/)).toBeVisible();
    if (isPhone(page)) await expectNoSidewaysScroll(page);
    expect(errors).toEqual([]);
  });

  test("the clinic sees a medical SOS on its page, takes it and logs the ambulance", async ({
    page,
  }) => {
    const errors = watchForAppErrors(page);
    await driverRaisesSos(page, /^Medical/);

    await switchTo(page, CLINIC);
    await page.waitForURL(/\/en\/admin\/emergencies$/);
    await page.goto("/en/admin/clinic");
    await expect(page.getByRole("heading", { level: 1, name: "Clinic" })).toBeVisible();
    const now = page.getByRole("region", { name: "Needs you now" });
    await expect(now.getByText(/Medical · Line 7/)).toBeVisible();
    await expectNoSidewaysScroll(page);
    await now.getByRole("link", { name: "Open" }).click();

    await page.getByRole("button", { name: "Take it" }).click();
    await expect(page.getByText(/Taken by Dr. Salma Nabil/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Send another bus or driver" })).toHaveCount(0);
    await page.getByRole("button", { name: "Ambulance called" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Ambulance called" }).click();
    await expect(page.getByText("Called an ambulance")).toBeVisible();
    expect(errors).toEqual([]);
  });
});
