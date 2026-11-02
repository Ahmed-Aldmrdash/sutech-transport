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
 */
export class StoredMap<V> extends Map<string, V> {
  constructor(
    private readonly storageKey: string,
    private readonly kind: MockStorage = MockStorage.Session,
  ) {
    super();
    try {
      const saved = storageFor(kind)?.getItem(storageKey);
      if (saved)
        for (const [key, value] of JSON.parse(saved) as [string, V][]) super.set(key, value);
    } catch {
      // No storage (tests, private mode): memory only.
    }
  }

  private save(): void {
    try {
      storageFor(this.kind)?.setItem(this.storageKey, JSON.stringify([...this.entries()]));
    } catch {
      // Memory only.
    }
  }

  override set(key: string, value: V): this {
    super.set(key, value);
    this.save();
    return this;
  }

  override delete(key: string): boolean {
    const removed = super.delete(key);
    this.save();
    return removed;
  }

  override clear(): void {
    super.clear();
    this.save();
  }
}
