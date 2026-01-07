import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import {
  createSessionStore,
  restoreSessionIfNeeded,
  createDebouncedSave,
  LS_KEY,
  type SessionPayload,
} from "../sessionStore";

describe("sessionStore", () => {
  beforeEach(() => {
    // Reset fake-indexeddb with a fresh instance
    globalThis.indexedDB = new IDBFactory();

    // Clear localStorage key
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      // Ignore if localStorage not available
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("createSessionStore", () => {
    it("writes and reads a session", async () => {
      const store = createSessionStore();
      const payload: SessionPayload = {
        v: 1,
        markdown: "# Test",
        updatedAt: Date.now(),
      };

      await store.write(payload);
      const result = await store.read();

      expect(result).toEqual(payload);
    });

    it("returns null when no session exists", async () => {
      const store = createSessionStore();
      const result = await store.read();

      expect(result).toBeNull();
    });

    it("clears the session", async () => {
      const store = createSessionStore();
      const payload: SessionPayload = {
        v: 1,
        markdown: "# Test",
        updatedAt: Date.now(),
      };

      await store.write(payload);
      await store.clear();
      const result = await store.read();

      expect(result).toBeNull();
    });

    it("does not save empty markdown", async () => {
      const store = createSessionStore();
      const payload: SessionPayload = {
        v: 1,
        markdown: "",
        updatedAt: Date.now(),
      };

      await store.write(payload);
      const result = await store.read();

      expect(result).toBeNull();
    });

    it("does not save whitespace-only markdown", async () => {
      const store = createSessionStore();
      const payload: SessionPayload = {
        v: 1,
        markdown: "   \n\t  ",
        updatedAt: Date.now(),
      };

      await store.write(payload);
      const result = await store.read();

      expect(result).toBeNull();
    });

    it("stores UI state", async () => {
      const store = createSessionStore();
      const payload: SessionPayload = {
        v: 1,
        markdown: "# Test",
        updatedAt: Date.now(),
        ui: { editorVisible: true, editorWidth: 500 },
      };

      await store.write(payload);
      const result = await store.read();

      expect(result?.ui).toEqual({ editorVisible: true, editorWidth: 500 });
    });

    it("reports availability", () => {
      const store = createSessionStore();
      expect(store.isAvailable()).toBe(true);
    });

    it("reads from localStorage fallback when IDB is empty", async () => {
      // Skip if localStorage.setItem is not available (happy-dom limitation)
      if (typeof localStorage.setItem !== "function") {
        return;
      }

      // Write directly to localStorage
      const payload: SessionPayload = {
        v: 1,
        markdown: "# From localStorage",
        updatedAt: Date.now(),
      };
      localStorage.setItem(LS_KEY, JSON.stringify(payload));

      const store = createSessionStore();
      const result = await store.read();

      expect(result?.markdown).toBe("# From localStorage");
    });

    it("overwrites existing session on write", async () => {
      const store = createSessionStore();

      await store.write({ v: 1, markdown: "# First", updatedAt: 1 });
      await store.write({ v: 1, markdown: "# Second", updatedAt: 2 });

      const result = await store.read();
      expect(result?.markdown).toBe("# Second");
    });
  });

  describe("restoreSessionIfNeeded", () => {
    it("restores session when editor is empty", async () => {
      const store = createSessionStore();
      await store.write({ v: 1, markdown: "# Restored", updatedAt: Date.now() });

      let setValue = "";
      let rendered = "";

      const restored = await restoreSessionIfNeeded(
        store,
        () => "",
        (v) => {
          setValue = v;
        },
        async (v) => {
          rendered = v;
        }
      );

      expect(restored).toBe(true);
      expect(setValue).toBe("# Restored");
      expect(rendered).toBe("# Restored");
    });

    it("does not restore when editor has content", async () => {
      const store = createSessionStore();
      await store.write({ v: 1, markdown: "# Saved", updatedAt: Date.now() });

      let setValue = "";

      const restored = await restoreSessionIfNeeded(
        store,
        () => "# Existing content",
        (v) => {
          setValue = v;
        },
        async () => {}
      );

      expect(restored).toBe(false);
      expect(setValue).toBe("");
    });

    it("restores when forced even if editor has content", async () => {
      const store = createSessionStore();
      await store.write({ v: 1, markdown: "# Saved", updatedAt: Date.now() });

      let setValue = "";

      const restored = await restoreSessionIfNeeded(
        store,
        () => "# Existing content",
        (v) => {
          setValue = v;
        },
        async () => {},
        { force: true }
      );

      expect(restored).toBe(true);
      expect(setValue).toBe("# Saved");
    });

    it("returns false when no session exists", async () => {
      const store = createSessionStore();

      const restored = await restoreSessionIfNeeded(
        store,
        () => "",
        () => {},
        async () => {}
      );

      expect(restored).toBe(false);
    });

    it("handles errors gracefully", async () => {
      const store = {
        read: async () => {
          throw new Error("Read failed");
        },
        write: async () => {},
        clear: async () => {},
        isAvailable: () => true,
      };

      const restored = await restoreSessionIfNeeded(
        store,
        () => "",
        () => {},
        async () => {}
      );

      expect(restored).toBe(false);
    });
  });

  describe("createDebouncedSave", () => {
    it("debounces saves with short delay", async () => {
      const store = createSessionStore();
      const { save } = createDebouncedSave(store, () => "# Content", 10);

      save();
      save();
      save();

      // Wait for debounce
      await new Promise((r) => setTimeout(r, 50));

      const result = await store.read();
      expect(result?.markdown).toBe("# Content");
    });

    it("flush saves immediately", async () => {
      const store = createSessionStore();
      const { save, flush } = createDebouncedSave(store, () => "# Flushed", 1000);

      save();
      flush();

      const result = await store.read();
      expect(result?.markdown).toBe("# Flushed");
    });

    it("does not save empty content", async () => {
      const store = createSessionStore();
      const { flush } = createDebouncedSave(store, () => "", 100);

      flush();

      const result = await store.read();
      expect(result).toBeNull();
    });

    it("uses latest content when debounced", async () => {
      const store = createSessionStore();
      let content = "# First";
      const { save } = createDebouncedSave(store, () => content, 10);

      save(); // Schedule save of "# First"
      content = "# Second";
      save(); // Cancel previous, schedule "# Second"

      // Wait for debounce
      await new Promise((r) => setTimeout(r, 50));

      const result = await store.read();
      expect(result?.markdown).toBe("# Second");
    });
  });
});
