import { describe, expect, it } from "vitest";
import { appendInlineToLastListItem, computeSafeIndent, getListContext } from "../listContext";

describe("computeSafeIndent", () => {
  it("keeps indent under list items", () => {
    const md = "- parent\n    ```mermaid\nA-->B\n```";
    const idx = md.indexOf("```");
    expect(computeSafeIndent("    ", md, idx)).toBe("    ");
  });

  it("clamps indent outside lists", () => {
    const md = "\n    ```mermaid\nA-->B\n```";
    const idx = md.indexOf("```");
    expect(computeSafeIndent("    ", md, idx)).toBe("   ");
  });
});

describe("getListContext", () => {
  it("returns list context for list items", () => {
    const md = "- parent\n  - child\n    ```mermaid\nA-->B\n```";
    const idx = md.indexOf("```");
    const ctx = getListContext(md, idx);
    expect(ctx.isList).toBe(true);
    expect(ctx.childIndent).toBe("    ");
  });

  it("returns non-list context otherwise", () => {
    const md = "Paragraph\n```mermaid\nA-->B\n```";
    const idx = md.indexOf("```");
    const ctx = getListContext(md, idx);
    expect(ctx.isList).toBe(false);
  });
});

describe("appendInlineToLastListItem", () => {
  it("appends inline HTML to last list item", () => {
    const out = "- Item one\n- Item two";
    const updated = appendInlineToLastListItem(out, "<img>");
    expect(updated).toBe("- Item one\n- Item two <img>");
  });

  it("returns null when last line is not a list item", () => {
    const out = "Paragraph\nMore text";
    const updated = appendInlineToLastListItem(out, "<img>");
    expect(updated).toBeNull();
  });
});
