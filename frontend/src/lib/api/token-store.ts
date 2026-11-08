/**
 * The mock server's stand-in for the browser's HttpOnly session cookie.
 *
 * In live mode the app never sees a token: FastAPI sets an HttpOnly, Secure, SameSite cookie
 * when the code is verified, and every request goes with `credentials: "include"`. Page
 * scripts can't read that cookie, so an injected script can't steal the session.
 *
 * The in-browser mock can't set a real HttpOnly cookie, so its login handler keeps the token
 * here instead (kept across reloads, like a cookie). Only mock code reads or writes it.
 */
const JAR_KEY = "sut.mock.cookie";

let currentToken: string | null = null;
let loaded = false;

function load(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    currentToken = window.localStorage.getItem(JAR_KEY);
  } catch {
    currentToken = null;
  }
}

function save(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(JAR_KEY, token);
    else window.localStorage.removeItem(JAR_KEY);
  } catch {
    // Blocked storage: the mock session lasts until the tab closes.
  }
}

export const tokenStore = {
  get(): string | null {
    load();
    return currentToken;
  },
  set(token: string | null): void {
    loaded = true;
    currentToken = token;
    save(token);
  },
  clear(): void {
    tokenStore.set(null);
  },
};
