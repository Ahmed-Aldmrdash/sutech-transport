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
