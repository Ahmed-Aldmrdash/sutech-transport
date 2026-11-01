import { expect, test, type Page } from "@playwright/test";
import { expectNoSidewaysScroll, isPhone, watchForErrors } from "./helpers";

const DEMO_CODE = "4821";

async function requestCode(page: Page, identifier: string) {
  await page.getByLabel("University ID, staff ID or phone").fill(identifier);
  await page.getByRole("button", { name: "Send code" }).click();
}

/** Signs in through the real screens: ID → code (auto-submits when complete). */
async function signIn(page: Page, identifier: string, path = "/en/login") {
  await page.goto(path);
  await requestCode(page, identifier);
  await expect(page.getByRole("heading", { name: "Enter the code" })).toBeVisible();
  await page.getByLabel("One-time code").fill(DEMO_CODE);
}

/** Mock answers take ~400ms; let the home page's own session check finish before editing. */
const SESSION_CHECK_SETTLE_MS = 1000;

async function editSavedSession(page: Page, change: string, value: string) {
  await page.waitForTimeout(SESSION_CHECK_SETTLE_MS);
  await page.evaluate(
    ({ key, next }) => {
      const session = JSON.parse(localStorage.getItem("sut.session") ?? "{}");
      session[key] =
        next === "past"
          ? new Date(Date.now() - 1000).toISOString()
          : next === "soon"
            ? new Date(Date.now() + 2500).toISOString()
            : next;
      localStorage.setItem("sut.session", JSON.stringify(session));
    },
    { key: change, next: value },
  );
}

async function signOut(page: Page) {
  if (isPhone(page)) await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Sign out" }).filter({ visible: true }).click();
}

test.describe("sign-in", () => {
  test("a student signs in, stays signed in, and signs out", async ({ page }) => {
    const errors = watchForErrors(page);
    await signIn(page, "240102791");
    await expect(page).toHaveURL(/\/en\/student$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome, Ahmed");
    await expectNoSidewaysScroll(page);

    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome, Ahmed");

    await signOut(page);
    await expect(page).toHaveURL(/\/en\/login\?reason=signed-out$/);
    await expect(page.getByText("You've signed out. See you soon.")).toBeVisible();
    await page.goto("/en/student/card");
    await expect(page).toHaveURL(/\/en\/login/);
    expect(errors).toEqual([]);
  });

  test("works in Arabic with Arabic digits", async ({ page }) => {
    await page.goto("/ar/login");
    await page.getByLabel("الرقم الجامعي أو رقم الموظف أو الموبايل").fill("٢٤٠١٠٢٧٩١");
    await page.getByRole("button", { name: "ابعت الكود" }).click();
    await expect(page.getByText("010•••••907")).toBeVisible();
    await page.getByLabel("كود الدخول").fill("٤٨٢١");
    await expect(page).toHaveURL(/\/ar\/student$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("أهلًا، Ahmed");
  });

  test("explains an unknown ID", async ({ page }) => {
    await page.goto("/en/login");
    await requestCode(page, "999999999");
    await expect(page.getByText("We couldn't find this ID.", { exact: false })).toBeVisible();
  });

  test("a disabled account can't ask for a code", async ({ page }) => {
    await page.goto("/en/login");
    await requestCode(page, "240100000");
    await expect(page.getByText("This account is disabled.", { exact: false })).toBeVisible();
  });

  test("counts wrong codes, then locks the account", async ({ page }) => {
    await page.goto("/en/login");
    await requestCode(page, "DRV-1001");
    const code = page.getByLabel("One-time code");
    await code.fill("1111");
    await expect(page.getByText("Wrong code. 2 attempts left.")).toBeVisible();
    await code.fill("2222");
    await expect(page.getByText("Wrong code. 1 attempt left.")).toBeVisible();
    await code.fill("3333");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByText("Too many wrong codes.", { exact: false })).toBeVisible();
  });

  test("lets the user go back and use a different ID", async ({ page }) => {
    await page.goto("/en/login");
    await requestCode(page, "240102791");
    await page.getByRole("button", { name: "Use a different ID" }).click();
    await expect(page.getByLabel("University ID, staff ID or phone")).toHaveValue("240102791");
    await expect(page.getByRole("button", { name: /Resend/ })).toHaveCount(0);
  });
});

test.describe("each role goes to its own home", () => {
  const homes = [
    { id: "240102791", path: "/en/student" },
    { id: "01098765432", path: "/en/parent" },
    { id: "DRV-1001", path: "/en/driver" },
    { id: "SUP-1001", path: "/en/driver" },
    { id: "TRN-1001", path: "/en/admin" },
    { id: "FIN-1001", path: "/en/admin/payments" },
    { id: "CLN-1001", path: "/en/admin/emergencies" },
    { id: "STA-1001", path: "/en/admin/violations" },
    { id: "SGO-1001", path: "/en/admin/reports" },
    { id: "BUS-1001", path: "/en/admin/bus-company" },
    { id: "ADM-1001", path: "/en/admin" },
  ];
  for (const { id, path } of homes) {
    test(`${id} → ${path}`, async ({ page }) => {
      const errors = watchForErrors(page);
      await signIn(page, id);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoSidewaysScroll(page);
      expect(errors).toEqual([]);
    });
  }
});

test.describe("strict separation", () => {
  test("a student can't open another role's pages", async ({ page }) => {
    await signIn(page, "240102791");
    await expect(page).toHaveURL(/\/en\/student$/);
    for (const path of ["/en/admin", "/en/admin/users", "/en/parent", "/en/driver/scan"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/en\/student$/);
    }
  });

  test("finance can't open transport or super admin pages", async ({ page }) => {
    await signIn(page, "FIN-1001");
    await expect(page).toHaveURL(/\/en\/admin\/payments$/);
    await page.goto("/en/admin/tracking");
    await expect(page).toHaveURL(/\/en\/admin\/payments$/);
    await page.goto("/en/admin/users");
    await expect(page).toHaveURL(/\/en\/admin\/payments$/);
    await page.goto("/en/admin/refunds");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Requests & refunds");
  });

  test("only the super admin sees users and permissions", async ({ page }) => {
    await signIn(page, "ADM-1001");
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/en/admin/users");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Users & permissions");
  });
});

test.describe("session", () => {
  test("an expired session sends the user to sign in, then back", async ({ page }) => {
    await signIn(page, "240102791");
    await expect(page).toHaveURL(/\/en\/student$/);
    await editSavedSession(page, "expires_at", "past");
    await page.goto("/en/student/card");
    await expect(page).toHaveURL(/\/en\/login\?next=%2Fstudent%2Fcard&reason=expired$/);
    await expect(page.getByText("Your session ended. Sign in again to continue.")).toBeVisible();

    await requestCode(page, "240102791");
    await page.getByLabel("One-time code").fill(DEMO_CODE);
    await expect(page).toHaveURL(/\/en\/student\/card$/);
  });

  test("signs out the moment the session expires", async ({ page }) => {
    await signIn(page, "240102791");
    await expect(page).toHaveURL(/\/en\/student$/);
    await editSavedSession(page, "expires_at", "soon");
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome, Ahmed");
    await expect(page).toHaveURL(/reason=expired/, { timeout: 10_000 });
  });

  test("a revoked token is caught by the server check", async ({ page }) => {
    await signIn(page, "240102791");
    await expect(page).toHaveURL(/\/en\/student$/);
    await editSavedSession(page, "token", "forged");
    await page.reload();
    await expect(page).toHaveURL(/reason=expired/);
  });

  test("signing out in one tab signs out the others", async ({ page, context }) => {
    await signIn(page, "240102791");
    await expect(page).toHaveURL(/\/en\/student$/);
    const other = await context.newPage();
    await other.goto("/en/student");
    await expect(other.getByRole("heading", { level: 1 })).toHaveText("Welcome, Ahmed");
    await signOut(page);
    await expect(other).toHaveURL(/\/en\/login/);
  });

  test("a signed-in user opening sign-in goes home", async ({ page }) => {
    await signIn(page, "TRN-1001");
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/en/login");
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/en");
    await expect(page).toHaveURL(/\/en\/admin$/);
  });
});
