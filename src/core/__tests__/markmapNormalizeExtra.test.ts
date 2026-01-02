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

  it("indents fences under preceding list items", () => {
    const input = `### Nested lists + code
- Level 1
  - Level 2
    - Level 3
      - Level 4 (deep indent)
        - Bullet with a short note
- Fenced code (non-mermaid)
\`\`\`js
function fib(n){ return n<2?n:fib(n-1)+fib(n-2); }
console.log(fib(10));
\`\`\`\``;
    const out = markmapNormalize(input);
    expect(out).toContain("- Fenced code (non-mermaid)");
    expect(out).toContain("\n  ```js");
    expect(out).toContain("\n  ````");
  });

});
