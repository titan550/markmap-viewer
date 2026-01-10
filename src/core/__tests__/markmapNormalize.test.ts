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

  describe("list context preservation", () => {
    it("preserves multiple continuation paragraphs", () => {
      const input = `- Item

    Para 1.

    Para 2.

    Para 3.

- Next`;
      const output = markmapNormalize(input);
      expect(output).toContain("Para 1.");
      expect(output).toContain("Para 2.");
      expect(output).toContain("Para 3.");
      expect(output).not.toContain("####");
    });

    it("preserves content after code fence in list", () => {
      const input = `- Item
    \`\`\`js
    const x = 1;
    \`\`\`

    Paragraph after code.

- Next item`;
      const output = markmapNormalize(input);
      expect(output).toContain("Paragraph after code.");
      expect(output).not.toContain("####");
    });

    it("preserves content after math block in list", () => {
      const input = `- Math item

    $$
    E = mc^2
    $$

    Text after math.

- Next`;
      const output = markmapNormalize(input);
      expect(output).toContain("Text after math.");
      expect(output).not.toContain("####");
    });

    it("exits list context on unindented paragraph", () => {
      const input = `- Item

Not in list.`;
      const output = markmapNormalize(input);
      // Should be promoted to heading since it's not indented
      expect(output).toMatch(/#{2,} Not in list\./);
    });

    it("preserves nested list content with continuations", () => {
      const input = `- Parent

    - Child 1

        Child 1 continuation.

    - Child 2

- Another parent`;
      const output = markmapNormalize(input);
      expect(output).toContain("Child 1 continuation.");
      expect(output).not.toContain("####");
    });

    it("handles real-world markdown with links in continuations", () => {
      const input = `### Recommendations

-   **Use Context7 as the default docs tool**, but **pair it with web search** for gaps.

    -   Codex: enable web search when you need fresh info. ([OpenAI](https://example.com))

    -   Claude: maintain a project CLAUDE.md. ([Anthropic](https://example.com))

-   **Security guardrail:**

    -   Treat retrieved docs as **untrusted input**.`;
      const output = markmapNormalize(input);
      // Nested list items should be preserved, not promoted
      expect(output).toContain("-   Codex:");
      expect(output).toContain("-   Claude:");
      expect(output).toContain("-   Treat retrieved docs");
      expect(output).not.toMatch(/#### .*Codex/);
      expect(output).not.toMatch(/#### .*Claude/);
    });
  });

  describe("additional edge cases", () => {
    it("preserves leading whitespace on first line", () => {
      const input = "  - Indented item\n  - Item 2";
      const output = markmapNormalize(input);
      expect(output.startsWith("  -")).toBe(true);
    });

    it("correctly indents fence inside indented list", () => {
      const input = "  - Item\n  ```js\n  code\n  ```";
      const output = markmapNormalize(input);
      const fenceLine = output.split("\n").find((l) => l.includes("```js"));
      // Should be at 4 spaces (list content indent), not 6 (doubled)
      expect(fenceLine).toBe("    ```js");
    });

    it("recognizes indented headings", () => {
      const input = "  # Heading\nContent";
      const output = markmapNormalize(input);
      expect(output).toContain("# Heading");
      expect(output).not.toContain("#### #");
    });

    it("does not treat mixed chars as horizontal rule", () => {
      const input = "-*-";
      const output = markmapNormalize(input);
      // Should be promoted to heading since it's not a valid hr
      expect(output).toContain("####");
    });

    it("treats valid horizontal rules correctly", () => {
      const input = "---";
      const output = markmapNormalize(input);
      // Should be preserved as-is (horizontal rule)
      expect(output).toBe("---\n");
    });

    it("preserves blank line before nested list item after fence", () => {
      const input = "- Parent\n  ```js\n  code\n  ```\n\n    - Child";
      const output = markmapNormalize(input);
      // Blank line before nested child should be preserved
      expect(output).toContain("```\n\n    -");
    });

    it("handles fence with no indent after list correctly", () => {
      const input = "- Item\n```js\ncode\n```";
      const output = markmapNormalize(input);
      const fenceLine = output.split("\n").find((l) => l.includes("```js"));
      // Should be indented to list content level (2 spaces)
      expect(fenceLine).toBe("  ```js");
    });

    it("handles fence with partial indent after list correctly", () => {
      const input = "- Item\n ```js\n code\n ```";
      const output = markmapNormalize(input);
      const fenceLine = output.split("\n").find((l) => l.includes("```js"));
      // Should be re-indented to 2 spaces, not 3 (1 original + 2 added)
      expect(fenceLine).toBe("  ```js");
    });
  });
});
