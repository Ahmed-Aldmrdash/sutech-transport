import { expect, test } from "@playwright/test";
import { failOnPageErrors, signIn, switchUser } from "./helpers";

const SUPER_ADMIN_PAGES = [
  "overview", "live", "sos", "attendance", "announcements", "lines", "buses", "students", "departures", "term", "payments",
  "requests", "violations", "complaints", "reports", "audit", "clinic", "secretary-general", "events", "bus-company", "users",
];

test("every admin page opens for the super admin without errors", async ({ page }) => {
  const errors = failOnPageErrors(page);
  await signIn(page, "admin");
  for (const path of SUPER_ADMIN_PAGES) {
    await page.goto(`/ar/admin/${path}`);
    await expect(page.locator("main h1").first()).toBeVisible();
    await expect(page.getByText("الصفحة دي مش ليك")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

const ROLE_HOME: [string, string, string][] = [
  ["transport", "overview", "users"],
  ["finance", "payments", "overview"],
  ["clinic", "clinic", "payments"],
  ["affairs", "violations", "students"],
  ["secretary", "secretary-general", "payments"],
  ["abulhoul", "bus-company", "overview"],
];

for (const [identifier, home, forbidden] of ROLE_HOME) {
  test(`${identifier} lands on ${home} and can't open ${forbidden}`, async ({ page }) => {
    await signIn(page, identifier);
    await expect(page).toHaveURL(new RegExp(`/admin/${home}$`));
    await page.goto(`/ar/admin/${forbidden}`);
    await expect(page.getByText("الصفحة دي مش ليك")).toBeVisible();
  });
}

test("deleting an announcement removes it for students", async ({ page }) => {
  await signIn(page, "admin");
  await page.goto("/ar/admin/announcements");
  await page.getByLabel("العنوان").fill("اختبار الحذف من الطلاب");
  await page.getByLabel("النص").fill("إعلان تجريبي هيتحذف حالًا.");
  await page.getByRole("button", { name: "انشر", exact: true }).click();
  const card = page.locator("article", { hasText: "اختبار الحذف من الطلاب" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "احذف" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "احذف" }).click();
  await expect(card).toHaveCount(0);

  await switchUser(page, "240102684");
  await page.goto("/ar/student/announcements");
  await expect(page.getByText("اختبار الحذف من الطلاب")).toHaveCount(0);
});
