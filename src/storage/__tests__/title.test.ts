import { describe, it, expect } from "vitest";
import { extractTitle, truncateTitle } from "../title";

describe("title", () => {
  describe("extractTitle", () => {
    it("extracts H1 heading", () => {
      expect(extractTitle("# My Title\n\nSome content")).toBe("My Title");
    });

    it("extracts H2 heading", () => {
      expect(extractTitle("## Second Level\n\nContent")).toBe("Second Level");
    });

    it("extracts H3 heading", () => {
      expect(extractTitle("### Third Level")).toBe("Third Level");
    });

    it("uses first non-empty line when no heading", () => {
      expect(extractTitle("Just some text\n\nMore text")).toBe("Just some text");
    });

    it("returns Untitled for empty content", () => {
      expect(extractTitle("")).toBe("Untitled");
      expect(extractTitle("   ")).toBe("Untitled");
    });

    it("strips list markers", () => {
      expect(extractTitle("- List item")).toBe("List item");
      expect(extractTitle("* Another item")).toBe("Another item");
      expect(extractTitle("1. Numbered")).toBe("Numbered");
    });

    it("strips blockquote markers", () => {
      expect(extractTitle("> Quote text")).toBe("Quote text");
    });

    it("strips bold formatting", () => {
      expect(extractTitle("**Bold title**")).toBe("Bold title");
    });

    it("strips italic formatting", () => {
      expect(extractTitle("*Italic title*")).toBe("Italic title");
    });

    it("strips inline code", () => {
      expect(extractTitle("`code` title")).toBe("code title");
    });

    it("strips link formatting", () => {
      expect(extractTitle("[Link text](http://example.com)")).toBe("Link text");
    });

    it("truncates long titles", () => {
      const longTitle = "# " + "A".repeat(100);
      const result = extractTitle(longTitle);
      expect(result.length).toBeLessThanOrEqual(50);
      expect(result.endsWith("…")).toBe(true);
    });
  });

  describe("truncateTitle", () => {
    it("returns short titles unchanged", () => {
      expect(truncateTitle("Short")).toBe("Short");
    });

    it("truncates long titles with ellipsis", () => {
      const long = "A".repeat(60);
      const result = truncateTitle(long);
      expect(result.length).toBe(50);
      expect(result.endsWith("…")).toBe(true);
    });

    it("respects custom max length", () => {
      const result = truncateTitle("Hello World", 5);
      expect(result).toBe("Hell…");
    });

    it("handles exact length", () => {
      expect(truncateTitle("12345", 5)).toBe("12345");
    });
  });
});
