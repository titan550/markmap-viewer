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

  it("unwraps markdown container fences with backticks", () => {
    const input = "````markdown\n# Title\n\n- Item\n````";
    const output = markmapNormalize(input);
    expect(output).toContain("# Title");
    expect(output).toContain("- Item");
    expect(output).not.toContain("````markdown");
  });

  it("unwraps markdown container fences with tildes", () => {
    const input = "~~~markdown\n# Title\n\n- Item\n~~~";
    const output = markmapNormalize(input);
    expect(output).toContain("# Title");
    expect(output).toContain("- Item");
    expect(output).not.toContain("~~~markdown");
  });

  it("converts loose lists to tight lists", () => {
    const input = `- Item 1

- Item 2

- Item 3`;
    const output = markmapNormalize(input);
    expect(output).not.toContain("\n\n-");
    expect(output).toContain("- Item 1\n- Item 2\n- Item 3");
  });

  it("removes blank line after code fence before list item", () => {
    const input = `- Item with fence
  \`\`\`mermaid
  flowchart LR
  \`\`\`

- Next item`;
    const output = markmapNormalize(input);
    expect(output).not.toMatch(/```\n\n-/);
  });
});
