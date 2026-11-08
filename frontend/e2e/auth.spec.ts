import { expect, test, type Page } from "@playwright/test";
import {
  expectNoSidewaysScroll,
  isPhone,
  requestCode,
  shownCode,
  signIn,
  watchForErrors,
  wrongCodeFor,
} from "./helpers";

/** Lets the page's own session check (GET /me) finish before the test edits the session. */
async function sessionChecked(page: Page) {
  await page.locator("html[data-session-checked]").waitFor({ state: "attached" });
}

async function editSavedSession(page: Page, change: string, value: string) {
  await sessionChecked(page);
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
    await signIn(page, "240100101");
    await expect(page).toHaveURL(/\/en\/student$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome, Ziad");
    await expectNoSidewaysScroll(page);

    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome, Ziad");

    await signOut(page);
    await expect(page).toHaveURL(/\/en\/login\?reason=signed-out$/);
    await expect(page.getByText("You've signed out. See you soon.")).toBeVisible();
    await page.goto("/en/student/card");
    await expect(page).toHaveURL(/\/en\/login/);
    expect(errors).toEqual([]);
  });

  test("works in Arabic with Arabic digits", async ({ page }) => {
    await page.goto("/ar/login");
    await page.getByLabel("الرقم الجامعي أو رقم الموظف أو الموبايل").fill("٢٤٠١٠٠١٠١");
    await page.getByRole("button", { name: "ابعت الكود" }).click();
    await expect(page.getByText("010•••••001")).toBeVisible();
    const arabicCode = (await shownCode(page)).replace(/\d/g, (digit) =>
      String.fromCharCode(0x0660 + Number(digit)),
    );
    await page.getByLabel("كود الدخول").fill(arabicCode);
    await expect(page).toHaveURL(/\/ar\/student$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("أهلًا، زياد");
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
    const right = await shownCode(page);
    await code.fill(wrongCodeFor(right, 1));
    await expect(page.getByText("Wrong code. 2 attempts left.")).toBeVisible();
    await code.fill(wrongCodeFor(right, 2));
    await expect(page.getByText("Wrong code. 1 attempt left.")).toBeVisible();
    await code.fill(wrongCodeFor(right, 3));
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByText("Too many wrong codes.", { exact: false })).toBeVisible();
  });

  test("keeps the code step when the language, theme or page changes", async ({ page }) => {
    await page.goto("/en/login");
    await requestCode(page, "240100101");
    const code = await shownCode(page);

    await page
      .getByRole("button", { name: /Appearance/ })
      .filter({ visible: true })
      .click();
    await expect(page.getByRole("heading", { name: "Enter the code" })).toBeVisible();

    // The server itself renders the code step, so a full page load never flashes step 1.
    const html = await (await page.request.get("/ar/login")).text();
    expect(html).toContain("اكتب الكود");
    expect(html).not.toContain("تسجيل الدخول</h1>");

    await page.getByRole("button", { name: "Switch to Arabic" }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/ar\/login$/);
    await expect(page.getByRole("heading", { name: "اكتب الكود" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "اكتب الكود" })).toBeVisible();
    await page.getByLabel("كود الدخول").fill(code);
    await expect(page).toHaveURL(/\/ar\/student$/);

    await page.goto("/ar/login?reason=signed-out");
    await expect(page).toHaveURL(/\/ar\/student$/);
  });

  test("lets the user go back and use a different ID", async ({ page }) => {
    await page.goto("/en/login");
    await requestCode(page, "240100101");
    await page.getByRole("button", { name: "Use a different ID" }).click();
    await expect(page.getByLabel("University ID, staff ID or phone")).toHaveValue("240100101");
    await expect(page.getByRole("button", { name: /Resend/ })).toHaveCount(0);
  });
});

test.describe("each role goes to its own home", () => {
  const homes = [
    { id: "240100101", path: "/en/student" },
    { id: "01000002000", path: "/en/parent" },
    { id: "DRV-1001", path: "/en/driver" },
    { id: "SUP-1001", path: "/en/driver" },
    // Offices land on their first built page; one with none yet gets its "coming soon" home.
    { id: "TRN-1001", path: "/en/admin/emergencies" },
    { id: "FIN-1001", path: "/en/admin" },
    { id: "CLN-1001", path: "/en/admin/emergencies" },
    { id: "STA-1001", path: "/en/admin" },
    { id: "SGO-1001", path: "/en/admin" },
    { id: "BUS-1001", path: "/en/admin" },
    { id: "ADM-1001", path: "/en/admin/emergencies" },
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
    await signIn(page, "240100101");
    await expect(page).toHaveURL(/\/en\/student$/);
    for (const path of ["/en/admin", "/en/admin/emergencies", "/en/parent", "/en/driver/scan"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/en\/student$/);
    }
  });

  test("finance can't open transport or super admin pages", async ({ page }) => {
    await signIn(page, "FIN-1001");
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/en/admin/emergencies");
    await expect(page).toHaveURL(/\/en\/admin$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome, Nadia");
  });

  test("pages that aren't built show as coming soon inside the app", async ({ page }) => {
    await signIn(page, "FIN-1001");
    await expect(page.getByText("Coming soon", { exact: true })).toBeVisible();
    // A coming page opens a short "being built" page in the office's own frame.
    if (isPhone(page)) await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("link", { name: /^Payments/ }).click();
    await page.waitForURL(/\/en\/admin\/payments$/);
    await expect(
      page.getByRole("heading", { name: "This page is still being built" }),
    ).toBeVisible();
  });

  test("the super admin lands on the emergencies desk", async ({ page }) => {
    await signIn(page, "ADM-1001");
    await expect(page).toHaveURL(/\/en\/admin\/emergencies$/);
    await page.goto("/en/student");
    await expect(page).toHaveURL(/\/en\/admin\/emergencies$/);
  });
});

test.describe("session", () => {
  test("an expired session sends the user to sign in, then back", async ({ page }) => {
    await signIn(page, "240100101");
    await expect(page).toHaveURL(/\/en\/student$/);
    await editSavedSession(page, "expires_at", "past");
    await page.goto("/en/student/card");
    await expect(page).toHaveURL(/\/en\/login\?next=%2Fstudent%2Fcard&reason=expired$/);
    await expect(page.getByText("Your session ended. Sign in again to continue.")).toBeVisible();

    await requestCode(page, "240100101");
    await page.getByLabel("One-time code").fill(await shownCode(page));
    await expect(page).toHaveURL(/\/en\/student\/card$/);
  });

  test("signs out the moment the session expires", async ({ page }) => {
    await signIn(page, "240100101");
    await expect(page).toHaveURL(/\/en\/student$/);
    await editSavedSession(page, "expires_at", "soon");
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome, Ziad");
    await expect(page).toHaveURL(/reason=expired/, { timeout: 10_000 });
  });

  test("a revoked session is caught by the server check", async ({ page }) => {
    await signIn(page, "240100101");
    await expect(page).toHaveURL(/\/en\/student$/);
    // The page never holds the session token; this forges the mock's stand-in cookie.
    await sessionChecked(page);
    await page.evaluate(() => localStorage.setItem("sut.mock.cookie", "forged"));
    expect(await page.evaluate(() => localStorage.getItem("sut.session"))).not.toContain("token");
    await page.reload();
    await expect(page).toHaveURL(/reason=expired/);
  });

  test("signing out in one tab signs out the others", async ({ page, context }) => {
    await signIn(page, "240100101");
    await expect(page).toHaveURL(/\/en\/student$/);
    const other = await context.newPage();
    await other.goto("/en/student");
    await expect(other.getByRole("heading", { level: 1 })).toHaveText("Welcome, Ziad");
    await signOut(page);
    await expect(other).toHaveURL(/\/en\/login/);
  });

  test("a signed-in user opening sign-in goes home", async ({ page }) => {
    await signIn(page, "TRN-1001");
    await expect(page).toHaveURL(/\/en\/admin\/emergencies$/);
    // The server redirects before any HTML, so Back to the sign-in page never shows the form.
    const response = await page.request.get("/en/login?reason=signed-out", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toMatch(/\/en\/admin\/emergencies$/);
    await page.goto("/en/login");
    await expect(page).toHaveURL(/\/en\/admin\/emergencies$/);
    await page.goto("/en");
    await expect(page).toHaveURL(/\/en\/admin\/emergencies$/);
  });
});
