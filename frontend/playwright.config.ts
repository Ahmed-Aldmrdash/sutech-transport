import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

/** End-to-end tests run against a production build, on a laptop and on a phone. */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // A fixed, modest worker count: the tests share one production server, and too many at
  // once made the slower flows time out (audit FUNC-8).
  workers: process.env.CI ? 2 : 3,
  // The longest flows (sign in, book, pay, switch accounts) take a while on a busy machine.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "laptop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 800 } },
    },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    // The tests run the mock demo, with its developer pages.
    env: { NEXT_PUBLIC_API_MODE: "mock", NEXT_PUBLIC_DEV_PAGES: "true" },
    url: `${BASE_URL}/ar`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
