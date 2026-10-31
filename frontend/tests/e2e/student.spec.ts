import { expect, test } from "@playwright/test";
import { failOnPageErrors, signIn } from "./helpers";

test("a new student books a seat, pays with Fawry and gets a card", async ({ page }) => {
  const errors = failOnPageErrors(page);
  await signIn(page, "240102791");
  await expect(page.getByRole("heading", { name: /مفيش اشتراك/ })).toBeVisible();

  await page.getByRole("link", { name: "احجز مكانك" }).click();
  await page.locator('a[href*="/student/lines/"]').first().click();
  await page.locator("input[type=radio]:not([disabled])").first().check();
  await page.getByRole("button", { name: "احجز المكان ده" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "احجز", exact: true }).click();
  await expect(page).toHaveURL(/\/student\/payment/);

  await page.getByRole("button", { name: "اطلع كود فوري" }).click();
  await expect(page.getByText("كود فوري", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /اعتبر إن فوري/ }).click();
  await expect(page.getByText("نشط", { exact: true })).toBeVisible();

  await page.goto("/ar/student/card");
  await expect(page.getByRole("img", { name: "كود الكارنيه للمسح" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("an active student reports not going today and takes it back", async ({ page }) => {
  await signIn(page, "240102684");
  await page.getByRole("button", { name: "مش رايح النهارده" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "أيوه، مش رايح" }).click();
  await expect(page.getByRole("button", { name: "لا، هروح عادي" })).toBeVisible();
  await page.getByRole("button", { name: "لا، هروح عادي" }).click();
  await expect(page.getByRole("button", { name: "مش رايح النهارده" })).toBeVisible();
});

test("a student without a subscription can't open the card", async ({ page }) => {
  await signIn(page, "240102791");
  await page.goto("/ar/student/card");
  await expect(page.getByText("الكارنيه بيظهر للمشتركين بس")).toBeVisible();
});

test("the English interface is left-to-right and fully translated", async ({ page }) => {
  await signIn(page, "240102684");
  await page.goto("/en/student/more");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { name: "More" })).toBeVisible();
  await expect(page.getByText("Announcements", { exact: true })).toBeVisible();
});

test("resetting the demo data signs out and starts fresh", async ({ page }) => {
  await signIn(page, "240102684");
  await page.goto("/ar/student/settings");
  await page.getByRole("button", { name: "رجّع بيانات الديمو" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "رجّع بيانات الديمو" }).click();
  await expect(page).toHaveURL(/\/ar\/login$/);
  await expect(page.getByRole("button", { name: "ابعتلي كود" })).toBeVisible();
});
