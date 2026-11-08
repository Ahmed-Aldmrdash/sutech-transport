import { expect, test, type Page } from "@playwright/test";
import { expectNoSidewaysScroll, signIn } from "./helpers";

const GUARDIAN = "01000002000"; // Ziad's father: Ziad (no booking) and Yassin (line 12)
const OMAR = "240100102"; // active on line 7, El Shorouk
const AHMED = "240100101"; // no booking
const YOUSSEF = "260100111"; // Ziad's brother, active on line 12

const TILE_HOST = "tile.openstreetmap.org";

/**
 * Map tiles come from OpenStreetMap and the tests don't depend on the internet: a tile that
 * fails to load is not an app error. Everything else still fails the test.
 */
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

async function startDemoTripIfIdle(page: Page) {
  const demo = page.getByRole("button", { name: /Play a demo trip/ });
  const map = page.getByRole("region", { name: "Live map of the bus" });
  await expect(demo.or(map)).toBeVisible();
  if (await demo.isVisible()) await demo.click();
  await expect(map).toBeVisible();
}

test.describe("guardian", () => {
  test("sees every child at once, the bus live, and each child's day", async ({ page }) => {
    const errors = watchForAppErrors(page);
    await signIn(page, GUARDIAN);
    await page.waitForURL(/\/en\/parent$/);

    // Both children on the home page, no switching needed.
    await expect(page.getByText("Yassin Tamer Nour")).toBeVisible();
    await expect(page.getByText("Ziad Tamer Nour")).toBeVisible();
    await expect(page.getByText("Ziad has no bus booking this term.")).toBeVisible();
    await expect(page.getByText("Line 12 · Nasr City")).toBeVisible();
    // One map per bus, named for who rides it.
    await expect(page.getByText("Line 12 · Yassin")).toBeVisible();
    await startDemoTripIfIdle(page);
    await expect(page.getByText("Ehab Riad").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Call Ehab Riad" })).toHaveAttribute(
      "href",
      "tel:01000004013",
    );
    await expectNoSidewaysScroll(page);

    await page.getByRole("link", { name: "Today's details" }).click();
    await page.waitForURL(/\/en\/parent\/day\?child=usr_student_11$/);
    await expect(page.getByRole("button", { name: "Yassin", pressed: true })).toBeVisible();
    await page.getByRole("button", { name: "Ziad" }).click();
    await expect(page.getByText("Ziad has no bus subscription")).toBeVisible();

    // The pick follows to the other pages.
    await page.goto("/en/parent/day");
    await expect(page.getByRole("button", { name: "Ziad", pressed: true })).toBeVisible();
    await page.getByRole("button", { name: "Yassin" }).click();
    await expect(page.getByRole("heading", { name: "So far today" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bus and driver" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("gets their children's notifications and opens the child's day", async ({ page }) => {
    const errors = watchForAppErrors(page);
    await signIn(page, GUARDIAN);
    await page.waitForURL(/\/en\/parent$/);
    await page.goto("/en/parent/notifications");
    const reached = page.getByRole("button", { name: /Yassin reached campus/ }).first();
    await expect(reached).toBeVisible();
    await reached.click();
    await page.waitForURL(/\/en\/parent\/day\?child=usr_student_11$/);
    await expect(page.getByRole("button", { name: "Yassin", pressed: true })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("switches language in place, names included", async ({ page }) => {
    const errors = watchForAppErrors(page);
    await signIn(page, GUARDIAN);
    await page.waitForURL(/\/en\/parent$/);
    await expect(page.getByText("Line 12 · Nasr City")).toBeVisible();
    await page.evaluate(() => {
      const w = window as unknown as { __noReload: boolean; __sawLoader: boolean };
      w.__noReload = true;
      w.__sawLoader = false;
      new MutationObserver(() => {
        if (document.querySelector(".min-h-dvh[role=status]")) w.__sawLoader = true;
      }).observe(document.documentElement, { childList: true, subtree: true });
    });
    await page.getByRole("button", { name: "Switch to Arabic" }).first().click();
    await page.waitForURL(/\/ar\/parent$/);
    await expect(page.getByText("ياسين تامر نور")).toBeVisible();
    await expect(page.getByText("خط 12 · ياسين")).toBeVisible();
    expect(
      await page.evaluate(() => {
        const w = window as unknown as { __noReload?: boolean; __sawLoader?: boolean };
        return { noReload: w.__noReload, sawLoader: w.__sawLoader };
      }),
    ).toEqual({ noReload: true, sawLoader: false });
    expect(errors).toEqual([]);
  });

  test("answers a child's line change and sees their days off", async ({ page }) => {
    const errors = watchForAppErrors(page);
    // Yassin asks to change line and reports a day off.
    await signIn(page, YOUSSEF);
    await page.waitForURL(/\/en\/student$/);
    await page.goto("/en/student/requests/new/line-change");
    await page.getByLabel("New line").selectOption("ln_05");
    await page.getByLabel("Pickup or drop-off stop").selectOption("ln_05_s1");
    await page.getByLabel("Why do you need to change?").fill("We moved near this line.");
    await page.getByLabel("Your mobile").fill("01000006684");
    await page.getByLabel("Guardian's mobile").fill("01000002000");
    await page.getByRole("button", { name: "Send request" }).click();
    await page.waitForURL(/\/en\/student\/requests\/req_/);
    await expect(page.getByText("Waiting for your guardian's approval")).toBeVisible();
    await page.goto("/en/student/not-going-today");
    await page.getByLabel("No lectures").check();
    await page.getByRole("button", { name: "Report the day" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Yes, I'm not going" }).click();
    await expect(page.getByText("Reported", { exact: true })).toBeVisible();

    // His father sees both, and approves.
    await page.evaluate(() => window.localStorage.removeItem("sut.session"));
    await signIn(page, GUARDIAN);
    await page.waitForURL(/\/en\/parent$/);
    await expect(page.getByText("Days they won't ride")).toBeVisible();
    await page.goto("/en/parent/notifications");
    await expect(page.getByText(/Yassin won't ride/).first()).toBeVisible();
    await page.getByRole("button", { name: /Yassin asked to change line/ }).click();
    await page.waitForURL(/\/en\/parent\/approvals$/);
    await expect(page.getByText("Line change · Yassin Tamer Nour")).toBeVisible();
    await expectNoSidewaysScroll(page);
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Yes, approve" }).click();
    await expect(page.getByText(/You approved it on/)).toBeVisible();
    await expect(page.getByText("Nothing waiting for you")).toBeVisible();

    // Yassin sees it went to the office.
    await page.evaluate(() => window.localStorage.removeItem("sut.session"));
    await signIn(page, YOUSSEF);
    await page.waitForURL(/\/en\/student$/);
    await page.goto("/en/student/requests");
    await page.getByText("Line 12 → Line 5").first().click();
    await expect(
      page.getByText("Your guardian approved; sent to the Transportation office"),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("can't open a student's pages", async ({ page }) => {
    await signIn(page, GUARDIAN);
    await page.waitForURL(/\/en\/parent$/);
    await page.goto("/en/student/tracking");
    await page.waitForURL(/\/en\/parent$/);
  });
});

test.describe("student bus tracking", () => {
  test("a subscriber follows their bus and can call the driver", async ({ page }) => {
    const errors = watchForAppErrors(page);
    await signIn(page, OMAR);
    await page.waitForURL(/\/en\/student$/);
    await page.goto("/en/student/tracking");
    await expect(page.getByRole("heading", { name: "Track my bus", level: 1 })).toBeVisible();
    await startDemoTripIfIdle(page);
    await expect(page.getByRole("status").filter({ hasText: /your stop|campus/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Call Kamal Ezzat" })).toHaveAttribute(
      "href",
      "tel:01000004008",
    );
    await expectNoSidewaysScroll(page);
    expect(errors).toEqual([]);
  });

  test("the driver's number is only for the line's subscribers", async ({ page }) => {
    const errors = watchForAppErrors(page);
    await signIn(page, AHMED);
    await page.waitForURL(/\/en\/student$/);
    await page.goto("/en/student/lines/ln_07");
    await expect(page.getByText("Kamal Ezzat")).toBeVisible();
    await expect(
      page.getByText("The driver's number shows here for this line's subscribers."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Call/ })).toHaveCount(0);

    await page.goto("/en/student/tracking");
    await expect(page.getByText("You aren't subscribed yet")).toBeVisible();
    expect(errors).toEqual([]);
  });
});
