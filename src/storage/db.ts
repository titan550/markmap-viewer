/**
 * IndexedDB wrapper for snapshot storage.
 * All client storage is best-effort - can be evicted by browser.
 */

import { hashMarkdown } from "./hash";
import { extractTitle } from "./title";

const DB_NAME = "markmap-history";
const DB_VERSION = 1;
const STORE_NAME = "snapshots";

export type SnapshotRecord = {
  id: string;
  digest: string;
  title: string;
  markdown: string;
  createdAt: number;
  updatedAt: number;
  accessedAt: number;
  isPinned: boolean;
  charCount: number;
};

function generateId(): string {
  return crypto.randomUUID();
}

function openDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB not available"));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("by-digest", "digest", { unique: true });
        store.createIndex("by-createdAt", "createdAt", { unique: false });
        store.createIndex("by-isPinned", "isPinned", { unique: false });
      }
    };
  });
}

/**
 * Get a snapshot by its digest (hash).
 */
export async function getByDigest(
  digest: string
): Promise<SnapshotRecord | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("by-digest");
    const request = index.get(digest);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a snapshot by ID.
 */
export async function getById(id: string): Promise<SnapshotRecord | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export type SaveResult = {
  record: SnapshotRecord;
  isNew: boolean;
};

/**
 * Save a snapshot. Returns the saved record and whether it was newly created.
 * If content already exists (same digest), updates accessedAt and returns existing.
 */
export async function saveSnapshot(
  markdown: string,
  customTitle?: string
): Promise<SaveResult> {
  const trimmed = markdown.trim();
  if (!trimmed) {
    throw new Error("Cannot save empty content");
  }

  const digest = await hashMarkdown(trimmed);

  // Check if already exists
  const existing = await getByDigest(digest);
  if (existing) {
    // Update accessedAt
    existing.accessedAt = Date.now();
    await updateSnapshot(existing);
    return { record: existing, isNew: false };
  }

  // Create new record
  const now = Date.now();
  const record: SnapshotRecord = {
    id: generateId(),
    digest,
    title: customTitle?.trim() || extractTitle(trimmed),
    markdown: trimmed,
    createdAt: now,
    updatedAt: now,
    accessedAt: now,
    isPinned: false,
    charCount: trimmed.length,
  };

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(record);

    request.onsuccess = () => resolve({ record, isNew: true });
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update an existing snapshot.
 */
async function updateSnapshot(record: SnapshotRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a snapshot by ID.
 */
export async function deleteSnapshot(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * List all snapshots, sorted by createdAt descending (newest first).
 */
export async function listSnapshots(): Promise<SnapshotRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const records = request.result as SnapshotRecord[];
      // Sort by createdAt descending
      records.sort((a, b) => b.createdAt - a.createdAt);
      resolve(records);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Toggle pin status of a snapshot.
 */
export async function togglePin(id: string): Promise<SnapshotRecord | null> {
  const record = await getById(id);
  if (!record) return null;

  record.isPinned = !record.isPinned;
  record.updatedAt = Date.now();
  await updateSnapshot(record);
  return record;
}

/**
 * Update the title of a snapshot.
 */
export async function updateTitle(
  id: string,
  newTitle: string
): Promise<SnapshotRecord | null> {
  const record = await getById(id);
  if (!record) return null;

  record.title = newTitle.trim() || "Untitled";
  record.updatedAt = Date.now();
  await updateSnapshot(record);
  return record;
}

/**
 * Delete snapshots older than maxAgeDays that are not pinned.
 * Returns the number of deleted records.
 */
export async function expireOldSnapshots(maxAgeDays = 30): Promise<number> {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const all = await listSnapshots();
  let deleted = 0;

  for (const record of all) {
    if (!record.isPinned && record.createdAt < cutoff) {
      await deleteSnapshot(record.id);
      deleted++;
    }
  }

  return deleted;
}

/**
 * Get the total count of snapshots.
 */
export async function countSnapshots(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Check if storage is available.
 */
export function isStorageAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
}
