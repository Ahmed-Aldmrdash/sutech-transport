import { expect, test } from "@playwright/test";
import { expectNoSidewaysScroll, isPhone, signIn, watchForErrors } from "./helpers";

const MARIAM = "240100102"; // Seif, active on line 7
const AHMED = "240100101"; // no booking

test.describe("student requests, notifications and settings", () => {
  test("sends a line change, follows it and withdraws it", async ({ page }) => {
    const errors = watchForErrors(page);
    await signIn(page, MARIAM);
    await page.waitForURL(/\/en\/student$/);
    await page.goto("/en/student/requests");
    await expect(page.getByText("No requests yet")).toBeVisible();
    await page.getByRole("link", { name: "Change my line" }).click();
    await expect(page.getByRole("heading", { name: "Line change request" })).toBeVisible();

    await page.getByLabel("New line").selectOption("ln_12");
    await page.getByLabel("Pickup or drop-off stop").selectOption("ln_12_s3");
    await page.getByLabel("Temporary").check();
    await page.getByLabel("Until").fill("2027-01-10");
    await page.getByLabel("Why do you need to change?").fill("Staying with my aunt for a while.");
    await page.getByLabel("Your mobile").fill("01000006684");
    await page.getByLabel("Guardian's mobile").fill("0109 876 0684");
    await expect(page.getByText(/your guardian gets it in the app to approve/)).toBeVisible();
    await expectNoSidewaysScroll(page);
    await page.getByRole("button", { name: "Send request" }).click();

    await page.waitForURL(/\/en\/student\/requests\/req_/);
    await expect(page.getByText("Waiting for your guardian's approval")).toBeVisible();
    await expect(page.getByText("Line 7 → Line 12").first()).toBeVisible();
    await expectNoSidewaysScroll(page);

    await page.getByRole("button", { name: "Withdraw request" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Yes, withdraw" }).click();
    await expect(page.getByText("You withdrew this request")).toBeVisible();

    await page.getByRole("link", { name: "Requests" }).first().click();
    await page.waitForURL(/\/en\/student\/requests$/);
    await expect(page.getByText("Withdrawn", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("sends a project model permit and sees it on the request", async ({ page }) => {
    const errors = watchForErrors(page);
    await signIn(page, MARIAM);
    await page.waitForURL(/\/en\/student$/);
    await page.goto("/en/student/requests");
    await page.getByRole("link", { name: "Bring a project model" }).click();
    await expect(page.getByRole("heading", { name: "Project model permit" })).toBeVisible();

    await page.getByRole("button", { name: "Send permit" }).click();
    await expect(
      page.getByText("Accept the declaration before you send the permit."),
    ).toBeVisible();

    await page.getByLabel("Material").fill("Wood and acrylic");
    await page.getByLabel("Size / dimensions").fill("60 × 40 × 30 cm");
    await page.getByLabel("Display").check();
    await page.getByRole("textbox", { name: "Destination" }).fill("Project exhibition, building B");
    await page.getByLabel("Entry time").fill("07:30");
    await page.getByLabel("Exit time").fill("16:00");
    await page.getByLabel("Doctor / TA responsible for the project").fill("Dr. Nihal");
    await page.getByLabel("I accept the declaration").check();
    await expectNoSidewaysScroll(page);
    await page.getByRole("button", { name: "Send permit" }).click();

    await page.waitForURL(/\/en\/student\/requests\/req_/);
    await expect(page.getByText("Waiting for the office")).toBeVisible();
    await expect(page.getByText("Wood and acrylic", { exact: true })).toBeVisible();
    await expect(page.getByText("The office will add it")).toBeVisible();
    await expectNoSidewaysScroll(page);
    expect(errors).toEqual([]);
  });

  test("shows the refund policy and asks for documents for exceptional cases", async ({ page }) => {
    const errors = watchForErrors(page);
    await signIn(page, MARIAM);
    await page.waitForURL(/\/en\/student$/);
    await page.goto("/en/student/requests/new/refund");
    await expect(page.getByRole("heading", { name: "Refund policy" })).toBeVisible();
    await expect(page.getByText("25% deducted")).toBeVisible();
    await page.getByLabel("Health condition, disability or injury").check();
    await page.getByLabel("Tell us more").fill("I had surgery and can't travel this term.");
    await page
      .getByLabel("My guardian agrees to cancel the subscription and get the refund")
      .check();
    await page.getByRole("button", { name: "Send refund request" }).click();
    await expect(page.getByText("Attach the supporting document", { exact: false })).toBeVisible();
    await expectNoSidewaysScroll(page);
    expect(errors).toEqual([]);
  });

  test("complaints need a booking; a subscriber sends one and gets an answer page", async ({
    page,
  }) => {
    const errors = watchForErrors(page);
    await signIn(page, AHMED);
    await page.waitForURL(/\/en\/student$/);
    await page.goto("/en/student/complaints/new");
    await expect(page.getByText("Book a seat first")).toBeVisible();
    await page.goto("/en/student/requests/new/line-change");
    await expect(page.getByText("You need an active subscription")).toBeVisible();

    await page.evaluate(() => window.localStorage.removeItem("sut.session"));
    await signIn(page, MARIAM);
    await page.waitForURL(/\/en\/student$/);
    await page.goto("/en/student/complaints");
    await page.getByRole("link", { name: "New complaint" }).click();
    await page.getByLabel("About").selectOption("bus_condition");
    await page.getByLabel("What happened?").fill("The air conditioning on the bus didn't work.");
    await page.getByRole("button", { name: "Send complaint" }).click();
    await page.waitForURL(/\/en\/student\/complaints\/req_/);
    await expect(page.getByRole("heading", { name: "Bus condition" })).toBeVisible();
    await expectNoSidewaysScroll(page);
    expect(errors).toEqual([]);
  });

  test("notifications show a badge until they are read", async ({ page }) => {
    const errors = watchForErrors(page);
    await signIn(page, MARIAM);
    await page.waitForURL(/\/en\/student$/);
    const entry = isPhone(page)
      ? page
          .getByRole("navigation", { name: "Quick navigation" })
          .getByRole("link", { name: /Alerts/ })
      : page.getByRole("link", { name: /Notifications, \d+ new/ });
    await expect(isPhone(page) ? entry.getByText(/new/) : entry).toBeAttached();
    await entry.click();
    await expect(page.getByRole("heading", { name: "Notifications", level: 1 })).toBeVisible();
    // Only the student's own line: Seif rides line 7, so line 5's delay never reaches him.
    await expect(page.getByText("Line 7 is running about 15 minutes late")).toBeVisible();
    await expect(page.getByText("Line 5 is running about 10 minutes late")).toHaveCount(0);
    await page.getByRole("button", { name: "Mark all as read" }).click();
    await expect(page.getByRole("button", { name: "Mark all as read" })).toBeDisabled();
    if (!isPhone(page)) {
      await expect(
        page.getByRole("banner").getByRole("link", { name: "Notifications", exact: true }),
      ).toBeVisible();
    }
    await expectNoSidewaysScroll(page);
    expect(errors).toEqual([]);
  });

  test("announcements filter by type and show only the student's own line", async ({ page }) => {
    await signIn(page, MARIAM);
    await page.waitForURL(/\/en\/student$/);
    await page.goto("/en/student/announcements");
    await page.getByRole("button", { name: "Delay" }).click();
    await expect(page.getByText("Line 7 is running about 15 minutes late")).toBeVisible();
    await expect(page.getByText("Line 5 is running about 10 minutes late")).toHaveCount(0);
    await expect(page.getByText("Accepted ways to pay")).toHaveCount(0);
  });

  test("settings change the theme and language, and sign out", async ({ page }) => {
    const errors = watchForErrors(page);
    await signIn(page, AHMED);
    await page.waitForURL(/\/en\/student$/);
    await page.goto("/en/student/settings");
    await expect(page.getByText("240100101")).toBeVisible();
    await page.getByRole("radio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    // The switch happens in place: no reload and no full-page loader in between.
    await page.evaluate(() => {
      const w = window as unknown as { __noReload: boolean; __sawLoader: boolean };
      w.__noReload = true;
      w.__sawLoader = false;
      new MutationObserver(() => {
        if (document.querySelector(".min-h-dvh[role=status]")) w.__sawLoader = true;
      }).observe(document.documentElement, { childList: true, subtree: true });
    });
    await page.getByRole("radio", { name: "العربية" }).click();
    await page.waitForURL(/\/ar\/student\/settings$/);
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Settings");
    expect(
      await page.evaluate(() => {
        const w = window as unknown as { __noReload?: boolean; __sawLoader?: boolean };
        return { noReload: w.__noReload, sawLoader: w.__sawLoader };
      }),
    ).toEqual({ noReload: true, sawLoader: false });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expectNoSidewaysScroll(page);
    await page.getByRole("main").getByRole("button", { name: "اخرج" }).click();
    await page.waitForURL(/\/ar\/login/);
    expect(errors).toEqual([]);
  });
});
