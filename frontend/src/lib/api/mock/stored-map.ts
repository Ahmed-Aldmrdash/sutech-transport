/** Where a mock keeps its memory between page loads. */
export const MockStorage = {
  /** Until the tab closes: one-time codes and locks, like a short-lived server cache. */
  Session: "session",
  /** Until cleared: bookings and receipts, so a demo picks up where it left off. */
  Local: "local",
} as const;
export type MockStorage = (typeof MockStorage)[keyof typeof MockStorage];

function storageFor(kind: MockStorage): Storage | null {
  try {
    return kind === MockStorage.Session ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * A Map saved to browser storage, so a reload or a language switch (a full page load) doesn't
 * make the mock server forget what it just did, as a real server wouldn't.
 *
 * It re-reads storage before every read and write. Each tab has its own copy of the mock
 * server, so without that a tab opened earlier (say, signed in as another student) would save
 * its stale copy over what this tab just saved, and a request would vanish.
 */
export class StoredMap<V> extends Map<string, V> {
  private loadedRaw: string | null = null;

  constructor(
    private readonly storageKey: string,
    private readonly kind: MockStorage = MockStorage.Session,
  ) {
    super();
    this.load();
  }

  /** Picks up what any tab saved since the last look. Cheap when nothing changed. */
  private load(): void {
    let saved: string | null;
    try {
      saved = storageFor(this.kind)?.getItem(this.storageKey) ?? null;
    } catch {
      return; // No storage (tests, private mode): memory only.
    }
    if (saved === this.loadedRaw) return;
    this.loadedRaw = saved;
    Map.prototype.clear.call(this);
    if (!saved) return;
    try {
      for (const [key, value] of JSON.parse(saved) as [string, V][]) super.set(key, value);
    } catch {
      // Unreadable: start empty.
    }
  }

  private save(): void {
    try {
      const raw = JSON.stringify([...super.entries()]);
      storageFor(this.kind)?.setItem(this.storageKey, raw);
      this.loadedRaw = raw;
    } catch {
      // Memory only.
    }
  }

  override get(key: string): V | undefined {
    this.load();
    return super.get(key);
  }

  override has(key: string): boolean {
    this.load();
    return super.has(key);
  }

  override get size(): number {
    this.load();
    return super.size;
  }

  override entries(): MapIterator<[string, V]> {
    this.load();
    return super.entries();
  }

  override values(): MapIterator<V> {
    this.load();
    return super.values();
  }

  override keys(): MapIterator<string> {
    this.load();
    return super.keys();
  }

  override [Symbol.iterator](): MapIterator<[string, V]> {
    return this.entries();
  }

  override forEach(callback: (value: V, key: string, map: Map<string, V>) => void): void {
    this.load();
    super.forEach(callback);
  }

  override set(key: string, value: V): this {
    this.load();
    super.set(key, value);
    this.save();
    return this;
  }

  override delete(key: string): boolean {
    this.load();
    const removed = super.delete(key);
    this.save();
    return removed;
  }

  override clear(): void {
    Map.prototype.clear.call(this);
    this.save();
  }
}
