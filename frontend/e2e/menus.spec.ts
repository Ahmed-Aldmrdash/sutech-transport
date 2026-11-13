import { expect, test } from "@playwright/test";
import { expectNoSidewaysScroll, isPhone, signIn } from "./helpers";

/**
 * Every link in every role's menu opens a real page (a heading, no "page not found"), and on
 * a phone none of them scrolls sideways. Catches a menu item that points nowhere.
 */

const ACCOUNTS = [
  "240100102",
  "01000002001",
  "DRV-1001",
  "TRN-1001",
  "FIN-1001",
  "STA-1001",
  "CLN-1001",
  "SGO-1001",
  "BUS-1001",
  "ADM-1001",
];

for (const identifier of ACCOUNTS) {
  test(`${identifier}: every menu link opens a page`, async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, identifier);
    await page.waitForURL((url) => !url.pathname.endsWith("/login"));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (isPhone(page)) await page.getByRole("button", { name: "Menu" }).first().click();
    const links = page.getByRole("navigation", { name: "Main navigation" }).getByRole("link");
    const hrefs = [
      ...new Set(
        (await links.evaluateAll((items) => items.map((item) => item.getAttribute("href")))).filter(
          (href): href is string => Boolean(href),
        ),
      ),
    ];
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      await page.goto(href);
      await expect(page.getByRole("heading", { level: 1 }), href).toBeVisible();
      await expect(page.getByText("Page not found"), href).toHaveCount(0);
      await expectNoSidewaysScroll(page);
    }
  });
}
