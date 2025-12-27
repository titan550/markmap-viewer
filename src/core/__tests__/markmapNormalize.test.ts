import { describe, expect, it } from "vitest";
import { markmapNormalize } from "../markmapNormalize";

describe("markmapNormalize", () => {
  it("converts setext headings", () => {
    const input = "Title\n====\n";
    const output = markmapNormalize(input);
    expect(output).toBe("# Title\n");
  });

  it("promotes freeform text to a heading below last explicit heading", () => {
    const input = "# Root\nFreeform paragraph\n";
    const output = markmapNormalize(input);
    expect(output).toBe("# Root\n## Freeform paragraph\n");
  });

  it("keeps fenced code blocks intact", () => {
    const input = "# Root\n```mermaid\nflowchart LR\nA-->B\n```\n";
    const output = markmapNormalize(input);
    expect(output).toContain("```mermaid\nflowchart LR\nA-->B\n```");
  });
});
