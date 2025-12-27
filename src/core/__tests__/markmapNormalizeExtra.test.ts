import { describe, expect, it } from "vitest";
import { markmapNormalize } from "../markmapNormalize";

describe("markmapNormalize extra", () => {
  it("adds Details separator when list followed by diagram", () => {
    const input = "# Title\n- Item\n```mermaid\nflowchart LR\nA-->B\n```";
    const out = markmapNormalize(input);
    expect(out).toContain("## Details");
  });

  it("converts freeform paragraph into heading", () => {
    const input = "# Title\nThis is a paragraph\nStill paragraph";
    const out = markmapNormalize(input);
    expect(out).toContain("## This is a paragraph Still paragraph");
  });

});
