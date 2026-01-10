import { describe, it, expect } from "vitest";
import { sha256, normalizeForHash, hashMarkdown } from "../hash";

describe("hash", () => {
  describe("sha256", () => {
    it("produces consistent hash for same input", async () => {
      const hash1 = await sha256("hello");
      const hash2 = await sha256("hello");
      expect(hash1).toBe(hash2);
    });

    it("produces different hash for different input", async () => {
      const hash1 = await sha256("hello");
      const hash2 = await sha256("world");
      expect(hash1).not.toBe(hash2);
    });

    it("produces 64-char hex string", async () => {
      const hash = await sha256("test");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("handles empty string", async () => {
      const hash = await sha256("");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("handles unicode", async () => {
      const hash = await sha256("你好世界 🌍");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("normalizeForHash", () => {
    it("trims whitespace", () => {
      expect(normalizeForHash("  hello  ")).toBe("hello");
    });

    it("normalizes line endings", () => {
      expect(normalizeForHash("a\r\nb")).toBe("a\nb");
    });

    it("collapses multiple blank lines", () => {
      expect(normalizeForHash("a\n\n\n\nb")).toBe("a\n\nb");
    });

    it("preserves single blank lines", () => {
      expect(normalizeForHash("a\n\nb")).toBe("a\n\nb");
    });
  });

  describe("hashMarkdown", () => {
    it("produces same hash for content differing only in whitespace", async () => {
      const hash1 = await hashMarkdown("# Hello\n\n- item");
      const hash2 = await hashMarkdown("  # Hello\n\n\n\n- item  ");
      expect(hash1).toBe(hash2);
    });

    it("produces different hash for different content", async () => {
      const hash1 = await hashMarkdown("# Hello");
      const hash2 = await hashMarkdown("# World");
      expect(hash1).not.toBe(hash2);
    });
  });
});
