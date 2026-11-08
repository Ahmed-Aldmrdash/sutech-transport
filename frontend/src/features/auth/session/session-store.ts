import { setUnauthorizedHandler } from "@/lib/api/client";
import { writeCookie } from "@/lib/cookies";
import { storedSessionSchema, type Session, type User } from "../schema";
import { SESSION_ROLE_COOKIE, SignInReason } from "../access";

const SESSION_STORAGE_KEY = "sut.session";
const MS_PER_SECOND = 1000;
/** Keys the app saves for the signed-in person (not the mock server's own data). */
const PERSONAL_KEY_PREFIX = "sut.";
const MOCK_KEY_PREFIX = "sut.mock.";
/**
 * Service worker caches that could hold an answer meant for one person (Serwist's defaults).
 * The app's own files (scripts, styles, fonts, pages) are the same for everyone and stay.
 */
const PERSONAL_CACHES = ["apis", "cross-origin", "others", "next-data", "static-data-assets"];

export const SessionStatus = {
  /** On the server and during hydration: the browser's storage hasn't been read yet. */
  Unknown: "unknown",
  SignedOut: "signed-out",
  SignedIn: "signed-in",
} as const;

export type SessionState =
  | { status: typeof SessionStatus.Unknown }
  | { status: typeof SessionStatus.SignedOut; reason: SignInReason | null }
  | { status: typeof SessionStatus.SignedIn; session: Session };

const UNKNOWN: SessionState = { status: SessionStatus.Unknown };

let state: SessionState = UNKNOWN;
let initialized = false;
const listeners = new Set<() => void>();

function readStorage(): Session | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = storedSessionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeStorage(session: Session | null): void {
  try {
    if (session) window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Private mode or blocked storage: the session still works until the tab closes.
  }
}

function isExpired(session: Session, now = Date.now()): boolean {
  return Date.parse(session.expires_at) <= now;
}

function writeRoleCookie(session: Session | null): void {
  const maxAge = session
    ? Math.max(0, Math.floor((Date.parse(session.expires_at) - Date.now()) / MS_PER_SECOND))
    : 0;
  writeCookie(SESSION_ROLE_COOKIE, session ? session.user.role : "", maxAge);
}

/**
 * Forgets everything this device kept for the person who just signed out: the app's own saved
 * picks (the guardian's selected child, …) and any runtime cache that could hold an answer
 * from the server. The mock server's data stays, as a real server's would.
 */
function clearPersonalData(): void {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
      keys
        .filter(
          (key): key is string =>
            key !== null &&
            key.startsWith(PERSONAL_KEY_PREFIX) &&
            !key.startsWith(MOCK_KEY_PREFIX) &&
            key !== SESSION_STORAGE_KEY,
        )
        .forEach((key) => storage.removeItem(key));
    } catch {
      // Blocked storage: nothing was saved.
    }
  }
  if ("caches" in window) {
    void caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((name) => PERSONAL_CACHES.includes(name)).map((name) => caches.delete(name)),
        ),
      )
      .catch(() => undefined);
  }
}

function apply(next: SessionState): void {
  state = next;
  writeRoleCookie(next.status === SessionStatus.SignedIn ? next.session : null);
  listeners.forEach((listener) => listener());
}

/** Reads the saved session once, dropping it if it has already expired. */
function stateFromStorage(): SessionState {
  const saved = readStorage();
  if (!saved) return { status: SessionStatus.SignedOut, reason: null };
  if (isExpired(saved)) {
    writeStorage(null);
    return { status: SessionStatus.SignedOut, reason: SignInReason.Expired };
  }
  return { status: SessionStatus.SignedIn, session: saved };
}

function initialize(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  apply(stateFromStorage());
  // Signing in or out in one tab does the same in the others.
  window.addEventListener("storage", (event) => {
    if (event.key === SESSION_STORAGE_KEY || event.key === null) apply(stateFromStorage());
  });
  setUnauthorizedHandler(() => sessionStore.end(SignInReason.Expired));
}

/**
 * Who is signed in and until when, kept in localStorage so it survives closing the app. It
 * holds no token: the server's HttpOnly cookie is the credential (see token-store).
 */
export const sessionStore = {
  getSnapshot(): SessionState {
    initialize();
    return state;
  },
  getServerSnapshot(): SessionState {
    return UNKNOWN;
  },
  subscribe(listener: () => void): () => void {
    initialize();
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  start(session: Session): void {
    writeStorage(session);
    apply({ status: SessionStatus.SignedIn, session });
  },
  updateUser(user: User): void {
    if (state.status !== SessionStatus.SignedIn) return;
    const session = { ...state.session, user };
    writeStorage(session);
    apply({ status: SessionStatus.SignedIn, session });
  },
  end(reason: SignInReason): void {
    if (state.status === SessionStatus.SignedOut) return;
    writeStorage(null);
    clearPersonalData();
    apply({ status: SessionStatus.SignedOut, reason });
  },
};
