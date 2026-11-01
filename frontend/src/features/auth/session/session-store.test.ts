import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MOCK_OTP_CODE } from "../mock-accounts";
import { tokenStore } from "@/lib/api/token-store";
import type { Session } from "../schema";

const HOUR_MS = 3_600_000;

async function freshStore() {
  vi.resetModules();
  // The client and the token store must be the same module instances the store uses.
  const store = await import("./session-store");
  const tokens = await import("@/lib/api/token-store");
  const api = await import("../api");
  return { ...store, tokenStore: tokens.tokenStore, api };
}

function sampleSession(expiresInMs: number): Session {
  return {
    token: "tok",
    expires_at: new Date(Date.now() + expiresInMs).toISOString(),
    user: { id: "u1", role: "student", name: "Ahmed", identifier: "240102791" },
  };
}

describe("session store", () => {
  // Each test loads fresh modules, so the mock server's memory starts empty too.
  beforeEach(() => window.localStorage.clear());
  afterEach(() => tokenStore.clear());

  it("starts signed out with nothing saved", async () => {
    const { sessionStore, SessionStatus } = await freshStore();
    expect(sessionStore.getServerSnapshot().status).toBe(SessionStatus.Unknown);
    expect(sessionStore.getSnapshot()).toEqual({ status: SessionStatus.SignedOut, reason: null });
  });

  it("keeps the session across a reload and sends its token", async () => {
    const first = await freshStore();
    first.sessionStore.getSnapshot();
    first.sessionStore.start(sampleSession(HOUR_MS));

    const second = await freshStore();
    const state = second.sessionStore.getSnapshot();
    expect(state.status).toBe(second.SessionStatus.SignedIn);
    expect(second.tokenStore.get()).toBe("tok");
  });

  it("drops an expired session and says why", async () => {
    window.localStorage.setItem("sut.session", JSON.stringify(sampleSession(-1000)));
    const { sessionStore, SessionStatus } = await freshStore();
    expect(sessionStore.getSnapshot()).toEqual({
      status: SessionStatus.SignedOut,
      reason: "expired",
    });
    expect(window.localStorage.getItem("sut.session")).toBeNull();
  });

  it("ignores a damaged saved session", async () => {
    window.localStorage.setItem("sut.session", "{not json");
    const { sessionStore, SessionStatus } = await freshStore();
    expect(sessionStore.getSnapshot().status).toBe(SessionStatus.SignedOut);
  });

  it("ends the session when the server answers 401", async () => {
    const { sessionStore, SessionStatus, api } = await freshStore();
    sessionStore.getSnapshot();
    sessionStore.start(sampleSession(HOUR_MS));
    await api.getMe().catch(() => undefined);
    expect(sessionStore.getSnapshot()).toEqual({
      status: SessionStatus.SignedOut,
      reason: "expired",
    });
    expect(window.localStorage.getItem("sut.session")).toBeNull();
  });

  it("works end to end with a real mock login", async () => {
    const { sessionStore, SessionStatus, api } = await freshStore();
    sessionStore.getSnapshot();
    await api.requestOtp("TRN-1001");
    sessionStore.start(await api.login("TRN-1001", MOCK_OTP_CODE));
    expect((await api.getMe()).role).toBe("transport_admin");
    sessionStore.end("signed-out");
    expect(sessionStore.getSnapshot()).toEqual({
      status: SessionStatus.SignedOut,
      reason: "signed-out",
    });
  });
});
