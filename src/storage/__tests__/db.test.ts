import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import {
  saveSnapshot,
  getById,
  getByDigest,
  deleteSnapshot,
  listSnapshots,
  togglePin,
  updateTitle,
  expireOldSnapshots,
  countSnapshots,
  isStorageAvailable,
} from "../db";

describe("db", () => {
  beforeEach(() => {
    // Reset fake-indexeddb
    globalThis.indexedDB = new IDBFactory();
  });

  describe("saveSnapshot", () => {
    it("saves a new snapshot", async () => {
      const markdown = "# Test\n\nContent";
      const { record, isNew } = await saveSnapshot(markdown);

      expect(isNew).toBe(true);
      expect(record.id).toBeDefined();
      expect(record.digest).toBeDefined();
      expect(record.title).toBe("Test");
      expect(record.markdown).toBe(markdown);
      expect(record.charCount).toBe(markdown.length);
      expect(record.isPinned).toBe(false);
    });

    it("returns existing record for duplicate content", async () => {
      const { record: record1 } = await saveSnapshot("# Same Content");
      const { record: record2, isNew } = await saveSnapshot("# Same Content");

      expect(isNew).toBe(false);
      expect(record1.id).toBe(record2.id);
      expect(record2.accessedAt).toBeGreaterThanOrEqual(record1.accessedAt);
    });

    it("saves with custom title", async () => {
      const { record } = await saveSnapshot("# Auto Title", "Custom Title");
      expect(record.title).toBe("Custom Title");
    });

    it("throws for empty content", async () => {
      await expect(saveSnapshot("")).rejects.toThrow("Cannot save empty content");
      await expect(saveSnapshot("   ")).rejects.toThrow("Cannot save empty content");
    });
  });

  describe("getById", () => {
    it("retrieves saved snapshot", async () => {
      const { record: saved } = await saveSnapshot("# Find Me");
      const found = await getById(saved.id);

      expect(found).not.toBeNull();
      expect(found?.markdown).toBe("# Find Me");
    });

    it("returns null for unknown id", async () => {
      const found = await getById("nonexistent");
      expect(found).toBeNull();
    });
  });

  describe("getByDigest", () => {
    it("retrieves snapshot by digest", async () => {
      const { record: saved } = await saveSnapshot("# By Digest");
      const found = await getByDigest(saved.digest);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(saved.id);
    });

    it("returns null for unknown digest", async () => {
      const found = await getByDigest("0".repeat(64));
      expect(found).toBeNull();
    });
  });

  describe("deleteSnapshot", () => {
    it("deletes a snapshot", async () => {
      const { record: saved } = await saveSnapshot("# Delete Me");
      await deleteSnapshot(saved.id);

      const found = await getById(saved.id);
      expect(found).toBeNull();
    });

    it("handles non-existent id gracefully", async () => {
      await expect(deleteSnapshot("nonexistent")).resolves.not.toThrow();
    });
  });

  describe("listSnapshots", () => {
    it("returns empty array when no snapshots", async () => {
      const list = await listSnapshots();
      expect(list).toEqual([]);
    });

    it("returns snapshots sorted by createdAt descending", async () => {
      await saveSnapshot("# First");
      await new Promise((r) => setTimeout(r, 10));
      await saveSnapshot("# Second");
      await new Promise((r) => setTimeout(r, 10));
      await saveSnapshot("# Third");

      const list = await listSnapshots();

      expect(list.length).toBe(3);
      expect(list[0].title).toBe("Third");
      expect(list[1].title).toBe("Second");
      expect(list[2].title).toBe("First");
    });
  });

  describe("togglePin", () => {
    it("toggles pin status", async () => {
      const { record: saved } = await saveSnapshot("# Pin Me");
      expect(saved.isPinned).toBe(false);

      const pinned = await togglePin(saved.id);
      expect(pinned?.isPinned).toBe(true);

      const unpinned = await togglePin(saved.id);
      expect(unpinned?.isPinned).toBe(false);
    });

    it("returns null for unknown id", async () => {
      const result = await togglePin("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("updateTitle", () => {
    it("updates snapshot title", async () => {
      const { record: saved } = await saveSnapshot("# Original Title\n\nContent");
      expect(saved.title).toBe("Original Title");

      const updated = await updateTitle(saved.id, "New Title");
      expect(updated?.title).toBe("New Title");

      const found = await getById(saved.id);
      expect(found?.title).toBe("New Title");
    });

    it("defaults to Untitled for empty title", async () => {
      const { record: saved } = await saveSnapshot("# Test");
      const updated = await updateTitle(saved.id, "   ");
      expect(updated?.title).toBe("Untitled");
    });

    it("returns null for unknown id", async () => {
      const result = await updateTitle("nonexistent", "New Title");
      expect(result).toBeNull();
    });
  });

  describe("expireOldSnapshots", () => {
    it("deletes old unpinned snapshots", async () => {
      // Create a snapshot with old createdAt
      const { record: saved } = await saveSnapshot("# Old One");

      // Manually backdate it
      const oldDate = Date.now() - 31 * 24 * 60 * 60 * 1000;
      const db = await new Promise<IDBDatabase>((resolve) => {
        const req = indexedDB.open("markmap-history", 1);
        req.onsuccess = () => resolve(req.result);
      });

      await new Promise<void>((resolve) => {
        const tx = db.transaction("snapshots", "readwrite");
        const store = tx.objectStore("snapshots");
        const getReq = store.get(saved.id);
        getReq.onsuccess = () => {
          const record = getReq.result;
          record.createdAt = oldDate;
          store.put(record);
          tx.oncomplete = () => resolve();
        };
      });

      const deleted = await expireOldSnapshots(30);
      expect(deleted).toBe(1);

      const list = await listSnapshots();
      expect(list.length).toBe(0);
    });

    it("preserves pinned snapshots", async () => {
      const { record: saved } = await saveSnapshot("# Pinned Old");
      await togglePin(saved.id);

      // Manually backdate
      const oldDate = Date.now() - 31 * 24 * 60 * 60 * 1000;
      const db = await new Promise<IDBDatabase>((resolve) => {
        const req = indexedDB.open("markmap-history", 1);
        req.onsuccess = () => resolve(req.result);
      });

      await new Promise<void>((resolve) => {
        const tx = db.transaction("snapshots", "readwrite");
        const store = tx.objectStore("snapshots");
        const getReq = store.get(saved.id);
        getReq.onsuccess = () => {
          const record = getReq.result;
          record.createdAt = oldDate;
          store.put(record);
          tx.oncomplete = () => resolve();
        };
      });

      const deleted = await expireOldSnapshots(30);
      expect(deleted).toBe(0);

      const list = await listSnapshots();
      expect(list.length).toBe(1);
    });
  });

  describe("countSnapshots", () => {
    it("returns 0 when empty", async () => {
      const count = await countSnapshots();
      expect(count).toBe(0);
    });

    it("returns correct count", async () => {
      await saveSnapshot("# One");
      await saveSnapshot("# Two");
      await saveSnapshot("# Three");

      const count = await countSnapshots();
      expect(count).toBe(3);
    });
  });

  describe("isStorageAvailable", () => {
    it("returns true when indexedDB exists", () => {
      expect(isStorageAvailable()).toBe(true);
    });
  });
});
