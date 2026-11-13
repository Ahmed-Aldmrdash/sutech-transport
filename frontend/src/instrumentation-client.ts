import { z } from "zod";

/**
 * Runs in the browser before the app starts. Zod normally tests for `new Function` to speed up
 * validation; our Content-Security-Policy forbids eval, so that test showed up as a CSP
 * violation on every page. Jitless mode skips it (validation stays the same).
 */
z.config({ jitless: true });
