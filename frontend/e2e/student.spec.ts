import { expect, test } from "@playwright/test";
import { expectNoSidewaysScroll, signIn, switchTo, watchForErrors } from "./helpers";

/** A one-pixel PNG standing in for the photo of a bank slip. */
const RECEIPT = {
  name: "slip.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64",
  ),
};

test.describe("student", () => {
  test("books a seat, uploads the receipt and gets the card once it's approved", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors = watchForErrors(page);
    await signIn(page, "240100101");
    await expect(
      page.getByText("You're not subscribed yet", { exact: true }).first(),
    ).toBeVisible();

    await page.goto("/en/student/lines");
    await page.getByLabel("Only lines with free seats").check();
    await expect(page.getByText("5 lines")).toBeVisible();
    await expectNoSidewaysScroll(page);

    await page.goto("/en/student/lines/ln_12");
    await page.locator("label[for='stop-ln_12_s7']").click();
    await page.getByRole("button", { name: "Book this seat" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Yes, book it" }).click();
    await page.waitForURL(/\/en\/student\/payment$/);
    await expect(page.getByText("There is no Fawry or InstaPay", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: "Send receipt" }).click();
    await expect(page.getByText("Attach the receipt.")).toBeVisible();

    await page.getByLabel("Reference number").fill("NBE-55512345");
    // Paid today: a receipt can't be older than the seat it pays for.
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
    await page.getByLabel("Payment date").fill(today);
    await page.getByLabel("Account holder or depositor").fill("Tamer Nour");
    await page.locator("input[type=file]").setInputFiles(RECEIPT);
    await page.getByRole("button", { name: "Send receipt" }).click();
    await expect(
      page.getByText("Your receipt is under review", { exact: true }).first(),
    ).toBeVisible();

    await page.goto("/en/student/card");
    await expect(
      page.getByText("Your receipt is being reviewed", { exact: true }).first(),
    ).toBeVisible();

    // Finance (FIN-1001) approves it on the payments desk; then the card opens.
    await switchTo(page, "FIN-1001");
    await page.waitForURL(/\/en\/admin\/payments$/);
    await page.getByRole("searchbox", { name: "Search" }).fill("240100101");
    await page.getByRole("link", { name: /Ziad/ }).click();
    await page.getByRole("button", { name: "Approve" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Approved: the seat is active.")).toBeVisible();

    await switchTo(page, "240100101");
    await page.waitForURL(/\/en\/student$/);
    await page.goto("/en/student/card");
    await expect(page.getByRole("img", { name: /Boarding code for/ })).toBeVisible();
    await expectNoSidewaysScroll(page);
    expect(errors).toEqual([]);
  });

  test("an active subscriber sees the line, the next trip and the card", async ({ page }) => {
    const errors = watchForErrors(page);
    await signIn(page, "240100102");
    await expect(page.getByText("You're subscribed", { exact: true }).first()).toBeVisible();
    await expectNoSidewaysScroll(page);

    await page.goto("/en/student/card");
    await expect(page.getByRole("img", { name: /Boarding code for/ })).toBeVisible();
    await expect(page.getByText("240100102")).toBeVisible();
    expect(errors).toEqual([]);
  });
});
