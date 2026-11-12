import { expect, type Page } from "@playwright/test";

/** Fails the test on any uncaught error or console error on the page. */
export function watchForErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

export async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, "the page must never scroll sideways").toBeLessThanOrEqual(0);
}

export function isPhone(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) < 1024;
}

/** Mock mode shows each new code on the code step, in place of the SMS. */
export async function shownCode(page: Page): Promise<string> {
  const text = await page.getByText(/(Demo code|كود التجربة): \d+/).textContent();
  return /\d{4,6}/.exec(text ?? "")?.[0] ?? "";
}

/** A code that is certainly not the right one. */
export function wrongCodeFor(code: string, salt: number): string {
  return code.replace(/^\d/, (digit) => String((Number(digit) + salt) % 10));
}

export async function requestCode(page: Page, identifier: string) {
  await page.getByLabel("University ID, staff ID or phone").fill(identifier);
  await page.getByRole("button", { name: "Send code" }).click();
}

/** Signs in through the real screens: ID → code (auto-submits when complete). */
export async function signIn(page: Page, identifier: string, path = "/en/login") {
  await page.goto(path);
  await requestCode(page, identifier);
  await expect(page.getByRole("heading", { name: "Enter the code" })).toBeVisible();
  await page.getByLabel("One-time code").fill(await shownCode(page));
}

/** The mock keeps its data in this browser, so the next role signs in on the same page. */
export async function switchTo(page: Page, identifier: string) {
  await page.evaluate(() => localStorage.removeItem("sut.session"));
  await page.context().clearCookies();
  await signIn(page, identifier);
}
