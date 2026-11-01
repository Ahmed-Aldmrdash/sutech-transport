import { setUnauthorizedHandler } from "@/lib/api/client";
import { tokenStore } from "@/lib/api/token-store";
import { storedSessionSchema, type Session, type User } from "../schema";
import { SignInReason } from "../access";

export const SESSION_STORAGE_KEY = "sut.session";

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

export function isExpired(session: Session, now = Date.now()): boolean {
  return Date.parse(session.expires_at) <= now;
}

function apply(next: SessionState): void {
  state = next;
  tokenStore.set(next.status === SessionStatus.SignedIn ? next.session.token : null);
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
 * The signed-in session, kept in localStorage so it survives closing the app, and mirrored
 * into the token store that adds `Authorization: Bearer` to every request.
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
    apply({ status: SessionStatus.SignedOut, reason });
  },
};
