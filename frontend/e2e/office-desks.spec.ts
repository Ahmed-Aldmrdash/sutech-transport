import { expect, test, type Page } from "@playwright/test";
import { expectNoSidewaysScroll, signIn, switchTo, watchForErrors } from "./helpers";

/** The office pages of phase 6: each office decides on its own page. */

async function landOn(page: Page, identifier: string, path: RegExp) {
  await signIn(page, identifier);
  await page.waitForURL(path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test.describe("finance", () => {
  test("records a Visa payment taken at office A045", async ({ page }) => {
    const errors = watchForErrors(page);
    await landOn(page, "FIN-1001", /\/en\/admin\/payments$/);
    await expect(page.getByRole("link", { name: /Nour Adel Hamdy/ })).toBeVisible();
    await expectNoSidewaysScroll(page);

    await page.getByRole("button", { name: "Record a Visa payment" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Student's university ID").fill("260100154");
    await dialog.getByRole("button", { name: "Find the booking" }).click();
    await expect(dialog.getByText("Youssef Hany Rizk")).toBeVisible();
    await dialog.getByLabel("Slip number").fill("POS-5550001");
    await dialog.getByRole("button", { name: "Record payment" }).click();
    await expect(
      page.getByText("Payment recorded. Youssef Hany Rizk's seat is active."),
    ).toBeVisible();

    await page.getByRole("button", { name: /^Approved/ }).click();
    await expect(page.getByRole("link", { name: /Youssef Hany Rizk/ })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("rejects a receipt with a reason", async ({ page }) => {
    await landOn(page, "FIN-1001", /\/en\/admin\/payments$/);
    await page.getByRole("link", { name: /Mariam Saad El Din/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Mariam Saad El Din" })).toBeVisible();
    // A seeded receipt was never uploaded: a sample slip stands in for it.
    await expect(page.getByRole("img", { name: "Receipt file" })).toHaveAttribute(
      "src",
      /^data:image\/svg\+xml/,
    );
    const dialog = page.getByRole("dialog");
    await expect(async () => {
      await page.getByRole("button", { name: "Reject" }).click();
      await expect(dialog).toBeVisible({ timeout: 2_000 });
    }).toPass();
    await dialog.getByRole("button", { name: "Reject" }).click();
    await expect(dialog.getByText("Tell the student what to fix", { exact: false })).toBeVisible();
    await dialog.getByLabel(/What's wrong/).fill("The photo isn't clear.");
    await dialog.getByRole("button", { name: "Reject" }).click();
    await expect(
      page.getByText(/^Rejected\. The student was told why and has 24 hours/),
    ).toBeVisible();
    await expectNoSidewaysScroll(page);
  });
});

test.describe("requests and violations", () => {
  test("transport approves a model permit and the student sees it", async ({ page }) => {
    const errors = watchForErrors(page);
    await landOn(page, "TRN-1001", /\/en\/admin\/emergencies$/);
    await page.goto("/en/admin/requests");
    await page.getByRole("link", { name: /Salma Wael Ezzat/ }).click();
    await page.getByRole("button", { name: "Open", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Open" }).click();
    await expect(page.getByText("Opened. The student sees it's being handled.")).toBeVisible();
    await page.getByRole("button", { name: "Approve" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Approved. The student was told.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await expectNoSidewaysScroll(page);
    expect(errors).toEqual([]);
  });

  test("student affairs closes a violation with a decision", async ({ page }) => {
    await landOn(page, "STA-1001", /\/en\/admin\/violations$/);
    await page.getByRole("link", { name: /Habiba Ashraf Kamal/ }).click();
    await expect(page.getByRole("img", { name: "The photo the crew took" })).toBeVisible();
    await page.getByRole("button", { name: "Close with a decision" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Close with a decision" }).click();
    await expect(dialog.getByText("Pick an outcome.")).toBeVisible();
    await dialog.getByRole("radio", { name: /Warning/ }).check();
    await dialog.getByLabel(/Note for the file/).fill("Met the student; first written warning.");
    await dialog.getByRole("button", { name: "Close with a decision" }).click();
    await expect(page.getByText("Closed: Warning")).toBeVisible();
    await expectNoSidewaysScroll(page);
  });

  test("transport follows violations without deciding", async ({ page }) => {
    await landOn(page, "TRN-1001", /\/en\/admin\/emergencies$/);
    await page.goto("/en/admin/violations");
    await page.getByRole("link", { name: /Habiba Ashraf Kamal/ }).click();
    await expect(
      page.getByText("Student Affairs decides on violations.", { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Close with a decision" })).toHaveCount(0);
  });
});

test.describe("announcements and reports", () => {
  test("transport posts for one line and its student sees it", async ({ page }) => {
    await landOn(page, "TRN-1001", /\/en\/admin\/emergencies$/);
    await page.goto("/en/admin/announcements");
    await page.getByRole("radio", { name: /Service change/ }).check();
    await page.getByLabel("Who sees it").selectOption("ln_07");
    await page.getByLabel("Title (Arabic)").fill("تغيير ميعاد أول محطة");
    await page.getByLabel("Title (English)").fill("First stop moves to 6:40");
    await page.getByLabel("Text (Arabic)").fill("من يوم الأحد أول محطة على خط 7 الساعة 6:40.");
    await page
      .getByLabel("Text (English)")
      .fill("From Sunday the first stop on line 7 is at 6:40.");
    await page.getByRole("button", { name: "Post" }).click();
    await expect(page.getByText("Posted.", { exact: true })).toBeVisible();
    await expectNoSidewaysScroll(page);

    await switchTo(page, "240100102");
    await page.waitForURL(/\/en\/student$/);
    await page.goto("/en/student/announcements");
    await expect(page.getByText("First stop moves to 6:40")).toBeVisible();
  });

  test("downloads a report as Excel and PDF", async ({ page }) => {
    const errors = watchForErrors(page);
    await landOn(page, "TRN-1001", /\/en\/admin\/emergencies$/);
    await page.goto("/en/admin/reports");
    await expect(page.getByRole("heading", { name: "Subscribers roster" })).toBeVisible();
    await page.getByLabel("Line", { exact: true }).selectOption("ln_07");
    await expect(page.getByText(/^Line 7 · .* · Made /)).toBeVisible();
    await expectNoSidewaysScroll(page);

    const [excel] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Excel" }).click(),
    ]);
    expect(excel.suggestedFilename()).toMatch(/^sutech_roster_7_\d{4}-\d{2}-\d{2}\.xlsx$/);
    const [pdf] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "PDF" }).click(),
    ]);
    expect(pdf.suggestedFilename()).toMatch(/^sutech_roster_7_\d{4}-\d{2}-\d{2}\.pdf$/);

    await page.getByRole("button", { name: "Attendance report" }).click();
    await expect(page.getByRole("heading", { name: "Attendance report" })).toBeVisible();
    expect(errors).toEqual([]);
  });
});
