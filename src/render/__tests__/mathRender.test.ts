import { describe, expect, it } from "vitest";
import { renderInlineMarkdown } from "../math";

describe("renderInlineMarkdown", () => {
  it("escapes text but keeps images", () => {
    const html = renderInlineMarkdown("<img src=\"x\"> &", {
      md: { renderInline: undefined },
    });
    expect(html).toContain("<img");
    expect(html).toContain("&amp;");
  });
});
