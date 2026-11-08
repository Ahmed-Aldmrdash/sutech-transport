import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tokenStore } from "@/lib/api/token-store";
import type { Session } from "../schema";

const HOUR_MS = 3_600_000;

async function freshStore() {
  vi.resetModules();
  // The client must be the same module instance the store uses.
  const store = await import("./session-store");
  const api = await import("../api");
  return { ...store, api };
}

function sampleSession(expiresInMs: number): Session {
  return {
    expires_at: new Date(Date.now() + expiresInMs).toISOString(),
    user: { id: "u1", role: "student", name: "Ahmed", identifier: "240100101" },
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

  it("keeps the session across a reload, with no token in page storage", async () => {
    const first = await freshStore();
    first.sessionStore.getSnapshot();
    first.sessionStore.start(sampleSession(HOUR_MS));

    const second = await freshStore();
    const state = second.sessionStore.getSnapshot();
    expect(state.status).toBe(second.SessionStatus.SignedIn);
    expect(window.localStorage.getItem("sut.session")).not.toMatch(/token/);
  });

  it("forgets the person's saved picks when they sign out", async () => {
    const { sessionStore } = await freshStore();
    sessionStore.getSnapshot();
    sessionStore.start(sampleSession(HOUR_MS));
    window.localStorage.setItem("sut.parent.child", "usr_student_11");
    window.localStorage.setItem("sut.mock.bookings", "{}");
    sessionStore.end("signed-out");
    expect(window.localStorage.getItem("sut.parent.child")).toBeNull();
    // The mock server's own data is the "server", not the person's device data.
    expect(window.localStorage.getItem("sut.mock.bookings")).toBe("{}");
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
    const { demo_code: code = "" } = await api.requestOtp("TRN-1001");
    sessionStore.start(await api.login("TRN-1001", code));
    expect((await api.getMe()).role).toBe("transport_admin");
    sessionStore.end("signed-out");
    expect(sessionStore.getSnapshot()).toEqual({
      status: SessionStatus.SignedOut,
      reason: "signed-out",
    });
  });
});
