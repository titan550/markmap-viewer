import { describe, expect, it } from "vitest";
import { markmapNormalize } from "../markmapNormalize";

describe("markmapNormalize extra", () => {
  it("preserves list followed by diagram without separator injection", () => {
    const input = "# Title\n- Item\n```mermaid\nflowchart LR\nA-->B\n```";
    const out = markmapNormalize(input);
    expect(out).toContain("# Title");
    expect(out).toContain("- Item");
    expect(out).toContain("```mermaid");
    expect(out).not.toContain("## Details");
    expect(out).not.toContain("## Diagram");
  });

  it("converts freeform paragraph into heading", () => {
    const input = "# Title\nThis is a paragraph\nStill paragraph";
    const out = markmapNormalize(input);
    expect(out).toContain("## This is a paragraph Still paragraph");
  });

});
