/**
 * Session persistence with IDB → localStorage fallback.
 * All client storage is best-effort; design so app works when empty/unavailable.
 */

export type SessionPayload = {
  v: 1;
  markdown: string;
  updatedAt: number;
  ui?: { editorVisible: boolean; editorWidth: number };
  lastManualDigest?: string;
};

export interface SessionStore {
  read(): Promise<SessionPayload | null>;
  write(payload: SessionPayload): Promise<void>;
  clear(): Promise<void>;
  isAvailable(): boolean;
}

const DB_NAME = "markmap-session";
const DB_VERSION = 1;
const STORE_NAME = "session";
const SESSION_KEY = "current";
export const LS_KEY = "markmap-session";
const LS_MAX_SIZE = 500_000; // 500KB limit for localStorage fallback

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };
    } catch {
      reject(new Error("IndexedDB not available"));
    }
  });
}

async function idbRead(): Promise<SessionPayload | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(SESSION_KEY);

    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? result.payload : null);
    };
    request.onerror = () => reject(request.error);
  });
}

async function idbWrite(payload: SessionPayload): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put({ key: SESSION_KEY, payload });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function idbClear(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(SESSION_KEY);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function lsRead(): SessionPayload | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.v === 1) {
      return parsed as SessionPayload;
    }
    return null;
  } catch {
    return null;
  }
}

function lsWrite(payload: SessionPayload): boolean {
  try {
    const serialized = JSON.stringify(payload);
    if (serialized.length > LS_MAX_SIZE) {
      console.warn("Session too large for localStorage fallback");
      return false;
    }
    localStorage.setItem(LS_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

function lsClear(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Request persistent storage (best-effort).
 * Call after first successful write or after user gesture.
 */
export async function tryRequestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    // Ignore
  }
  return false;
}

/**
 * Create a SessionStore with IDB → localStorage fallback.
 */
export function createSessionStore(): SessionStore {
  let persistenceRequested = false;

  return {
    async read(): Promise<SessionPayload | null> {
      // Try IDB first
      try {
        const payload = await idbRead();
        if (payload) return payload;
      } catch {
        // Fall through to localStorage
      }

      // Fallback to localStorage
      return lsRead();
    },

    async write(payload: SessionPayload): Promise<void> {
      // Don't save empty content
      if (!payload.markdown || !payload.markdown.trim()) {
        return;
      }

      let idbSuccess = false;

      // Try IDB first
      try {
        await idbWrite(payload);
        idbSuccess = true;
      } catch {
        // Fall through to localStorage
      }

      // Always try localStorage as backup (if small enough)
      lsWrite(payload);

      // Request persistent storage after first successful write
      if ((idbSuccess || lsRead()) && !persistenceRequested) {
        persistenceRequested = true;
        tryRequestPersistence();
      }
    },

    async clear(): Promise<void> {
      // Clear both storages
      try {
        await idbClear();
      } catch {
        // Ignore
      }
      lsClear();
    },

    isAvailable(): boolean {
      // Check if IndexedDB is available
      try {
        if (typeof indexedDB !== "undefined") {
          return true;
        }
      } catch {
        // Ignore
      }

      // Check localStorage
      try {
        const testKey = "__markmap_test__";
        localStorage.setItem(testKey, "1");
        localStorage.removeItem(testKey);
        return true;
      } catch {
        // Ignore
      }

      return false;
    },
  };
}

/**
 * Restore session if needed.
 * Returns true if session was restored, false otherwise.
 */
export async function restoreSessionIfNeeded(
  store: SessionStore,
  getCurrentValue: () => string,
  setValue: (value: string) => void,
  render: (value: string) => Promise<void>,
  options: { force?: boolean } = {}
): Promise<boolean> {
  try {
    const session = await store.read();
    if (!session || !session.markdown) {
      return false;
    }

    const currentValue = getCurrentValue();
    const shouldRestore = options.force || !currentValue || currentValue.trim() === "";

    if (shouldRestore) {
      setValue(session.markdown);
      await render(session.markdown);
      return true;
    }

    return false;
  } catch (error) {
    console.warn("Session restore failed:", error);
    return false;
  }
}

/**
 * Create a debounced session save function.
 */
export function createDebouncedSave(
  store: SessionStore,
  getValue: () => string,
  delay: number = 1000
): { save: () => void; flush: () => void } {
  let timeoutId: number | null = null;

  const doSave = () => {
    const markdown = getValue();
    if (markdown && markdown.trim()) {
      store.write({ v: 1, markdown, updatedAt: Date.now() });
    }
  };

  return {
    save() {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        doSave();
      }, delay);
    },
    flush() {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      doSave();
    },
  };
}
