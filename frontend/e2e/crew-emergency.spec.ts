import { expect, test, type Page } from "@playwright/test";
import { expectNoSidewaysScroll, isPhone, signIn } from "./helpers";

const DRIVER = "DRV-1001"; // Mohamed Hassan, line 7
const TRANSPORT = "TRN-1001"; // Karim Fathy, Transportation office
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

/** The mock keeps its data in this browser, so the next role signs in on the same page. */
async function switchTo(page: Page, identifier: string) {
  await page.evaluate(() => localStorage.removeItem("sut.session"));
  await page.context().clearCookies();
  await signIn(page, identifier);
}

async function driverRaisesSos(page: Page) {
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
    await page.getByRole("dialog").getByRole("button", { name: "Start", exact: true }).click();
    await expect(onTheRoad).toBeVisible();
  }
  await page.goto("/en/driver/sos");
  await page.getByRole("button", { name: /Bus problem/ }).click();
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
    const alarm = page.getByRole("alert").filter({ hasText: "New SOS: Bus problem on line 7" });
    await expect(alarm).toBeVisible();
    await alarm.getByRole("link", { name: "Open" }).click();

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
    await expect(page.getByText("The office changed today's bus")).toBeVisible();
    await expect(page.getByText(/Sayed Abdelhamid/)).toBeVisible();
    if (isPhone(page)) await expectNoSidewaysScroll(page);
    expect(errors).toEqual([]);
  });
});
