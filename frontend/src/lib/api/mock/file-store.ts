/**
 * The mock server's file storage: the receipts, documents and photos people upload, so an
 * office can open them like it would from the real server's short-lived links.
 *
 * Files live in IndexedDB (localStorage is too small for photos) and come back as object URLs.
 * The whole store loads once when the mock server starts; after that every lookup is
 * synchronous, so the mock builders that turn records into responses stay simple.
 */

const DB_NAME = "sut-mock-files";
const STORE = "files";
const DB_VERSION = 1;

interface StoredFile {
  contentType: string;
  data: Blob;
}

const urls = new Map<string, { url: string; contentType: string }>();
let ready: Promise<void> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null); // Private mode in some browsers: memory only.
    }
  });
}

function toUrl(data: Blob, base64: string | null, contentType: string): string {
  if (typeof URL.createObjectURL === "function") return URL.createObjectURL(data);
  return `data:${contentType};base64,${base64 ?? ""}`;
}

function remember(id: string, file: StoredFile, base64: string | null = null) {
  const old = urls.get(id);
  if (old?.url.startsWith("blob:")) URL.revokeObjectURL(old.url);
  urls.set(id, { url: toUrl(file.data, base64, file.contentType), contentType: file.contentType });
}

async function loadAll(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const store = db.transaction(STORE, "readonly").objectStore(STORE);
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return resolve();
        const file = current.value as StoredFile;
        if (!urls.has(String(current.key))) remember(String(current.key), file);
        current.continue();
      };
      cursor.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}

/** Resolves once the files saved in earlier visits are loaded. The mock server awaits it. */
export function mockFilesReady(): Promise<void> {
  ready ??= loadAll();
  return ready;
}

function decode(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** Keeps an uploaded file under the record's id. Usable at once; saved in the background. */
export function saveMockFile(id: string, contentType: string, base64: string): void {
  let data: Blob;
  try {
    data = new Blob([decode(base64)], { type: contentType });
  } catch {
    return; // Not base64: nothing to show, as a real server would reject it.
  }
  const file: StoredFile = { contentType, data };
  remember(id, file, base64);
  void openDb().then((db) => {
    if (!db) return;
    try {
      db.transaction(STORE, "readwrite").objectStore(STORE).put(file, id);
    } catch {
      // Full or blocked storage: the file still works until the page closes.
    }
  });
}

/** The link to a file saved under this id, or null when it was never saved here. */
export function mockFileUrl(id: string): { url: string; contentType: string } | null {
  return urls.get(id) ?? null;
}
