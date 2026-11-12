import { expect, test, type Page } from "@playwright/test";
import { expectNoSidewaysScroll, signIn, switchTo, watchForErrors } from "./helpers";

/** Phase 7: event buses between Transportation and Abu El Hol, and the Secretary General. */

async function landOn(page: Page, identifier: string, path: RegExp) {
  await signIn(page, identifier);
  await page.waitForURL(path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

/** A day three weeks ahead, as the date input wants it. */
function dayAhead(): string {
  const day = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
  return day.toISOString().slice(0, 10);
}

test("transport asks for event buses, Abu El Hol confirms, transport sees them", async ({
  page,
}) => {
  const errors = watchForErrors(page);
  await signIn(page, "TRN-1001");
  await page.waitForURL(/\/en\/admin\/emergencies$/);
  await page.goto("/en/admin/events");
  await expect(page.getByRole("heading", { level: 1, name: "Event buses" })).toBeVisible();
  await expectNoSidewaysScroll(page);

  await page.getByRole("link", { name: "New request" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Ask for event buses" })).toBeVisible();
  await page.getByLabel("Name").fill("Robotics fair visit");
  await page.getByLabel("Day").fill(dayAhead());
  await page.getByLabel("Leaves at").fill("08:00");
  await page.getByLabel("Returns at").fill("15:00");
  await page.getByLabel("Pick-up place").fill("Main gate");
  await page.getByLabel("Destination").fill("Cairo International Fair");
  await page.getByLabel("Number of students").fill("40");
  await page.getByRole("button", { name: "Use 1 buses" }).click();
  await expectNoSidewaysScroll(page);
  await page.getByRole("button", { name: "Send to Abu El Hol" }).click();
  await expect(page.getByText("Sent to Abu El Hol.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Robotics fair visit" })).toBeVisible();

  await switchTo(page, "BUS-1001");
  await page.waitForURL(/\/en\/admin\/bus-company$/);
  await page.getByRole("link", { name: /Robotics fair visit/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Robotics fair visit" })).toBeVisible();
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Confirm these buses" }).click();
  await expect(
    page.getByText("Confirmed. The university sees the buses and drivers."),
  ).toBeVisible();
  await expectNoSidewaysScroll(page);

  await switchTo(page, "TRN-1001");
  await page.waitForURL(/\/en\/admin\/emergencies$/);
  await page.goto("/en/admin/events");
  await page.getByRole("link", { name: /Robotics fair visit/ }).click();
  await expect(page.getByText("Abu El Hol confirmed the buses")).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  expect(errors).toEqual([]);
});

test("the company can't open the office's pages", async ({ page }) => {
  await landOn(page, "BUS-1001", /\/en\/admin\/bus-company$/);
  for (const path of ["/en/admin/events", "/en/admin/secretary-general", "/en/admin/emergencies"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/en\/admin\/bus-company$/);
  }
  await page.getByRole("link", { name: "Our buses" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Our buses" })).toBeVisible();
  await expectNoSidewaysScroll(page);
});

test("the Secretary General follows a student by university ID", async ({ page }) => {
  const errors = watchForErrors(page);
  await landOn(page, "SGO-1001", /\/en\/admin\/secretary-general$/);
  await expectNoSidewaysScroll(page);
  const id = page.getByLabel("University ID");
  await id.fill("999999999");
  await page.getByRole("button", { name: "Follow" }).click();
  await expect(page.getByText("No student with this university ID.")).toBeVisible();
  await id.fill("240100102");
  await page.getByRole("button", { name: "Follow" }).click();
  await expect(page.getByRole("button", { name: /^Stop following/ })).toBeVisible();
  await page.getByRole("button", { name: /^Stop following/ }).click();
  await expect(page.getByText("You don't follow any student yet.")).toBeVisible();
  await expectNoSidewaysScroll(page);
  expect(errors).toEqual([]);
});
