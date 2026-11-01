/**
 * Holds the access token sent as `Authorization: Bearer <token>`.
 * Phase 1 (login) decides where it is persisted; until then it lives in memory only.
 */
type Listener = (token: string | null) => void;

let currentToken: string | null = null;
const listeners = new Set<Listener>();

export const tokenStore = {
  get(): string | null {
    return currentToken;
  },
  set(token: string | null): void {
    currentToken = token;
    listeners.forEach((listener) => listener(token));
  },
  clear(): void {
    tokenStore.set(null);
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
