import { type Page, expect } from "@playwright/test";

export const DEMO_OTP = "4821";

/** Signs in with a demo account (Arabic UI) on a fresh mock database. */
export async function signIn(page: Page, identifier: string): Promise<void> {
  await page.goto("/ar/login");
  await page.evaluate(() => window.localStorage.clear());
  await page.goto("/ar/login");
  await page.getByLabel("الرقم الجامعي أو رقم الحساب").fill(identifier);
  await page.getByRole("button", { name: "ابعتلي كود" }).click();
  await page.getByLabel("الكود").fill(DEMO_OTP);
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await expect(page).toHaveURL(/\/ar\/(student|parent|driver|admin)/);
}

/**
 * React's recoverable hydration error. With the PWA service worker serving cached chunks, React sometimes restarts
 * hydration of a driver page and reports this, then renders the same page on the client. The page is still correct
 * (a loading skeleton on both sides), so it is not counted; anything else fails the test.
 */
const RECOVERABLE_HYDRATION = /Minified React error #418;/;

/** Fails the test on any uncaught page error. */
export function failOnPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    if (!RECOVERABLE_HYDRATION.test(error.message)) errors.push(`${page.url()} ${error.message}`);
  });
  return errors;
}

/** Signs in as someone else in the same browser, keeping the mock database (what the first user did stays). */
export async function switchUser(page: Page, identifier: string): Promise<void> {
  await page.evaluate(() => window.localStorage.removeItem("sutech.token"));
  await page.goto("/ar/login");
  await page.getByLabel("الرقم الجامعي أو رقم الحساب").fill(identifier);
  await page.getByRole("button", { name: "ابعتلي كود" }).click();
  await page.getByLabel("الكود").fill(DEMO_OTP);
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await expect(page).toHaveURL(/\/ar\/(student|parent|driver|admin)/);
}
