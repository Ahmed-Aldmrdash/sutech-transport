/* In mock mode the "WebSocket" is this in-page event bus. */
export interface LiveMessage {
  type: string;
  data: unknown;
}

type Listener = (message: LiveMessage) => void;
const listeners = new Set<Listener>();

export function onMockLive(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitMockLive(type: string, data: unknown): void {
  listeners.forEach((listener) => listener({ type, data }));
}
