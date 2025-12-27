import { describe, expect, it } from "vitest";
import { sanitizeMermaidLabel, sanitizeMermaidSourceLabels } from "../mermaidSanitize";

describe("sanitizeMermaidLabel", () => {
  it("encodes punctuation into Mermaid entities", () => {
    const raw = 'Status: "Processing #1" (Update Required)';
    expect(sanitizeMermaidLabel(raw)).toBe(
      "Status#colon;#32;#34;Processing#32;#35;1#34;#32;#40;Update#32;Required#41;"
    );
  });

  it("preserves existing Mermaid entities", () => {
    const raw = "#34;";
    expect(sanitizeMermaidLabel(raw)).toBe("#34;");
  });

  it("decodes Mermaid/html entities in markdown strings", () => {
    const raw = "Line1<br/>Line2 &quot;A&quot; #96; &#x3c;";
    const out = sanitizeMermaidLabel(raw, { useMarkdownStrings: true, lineBreak: "\\n" });
    expect(out).toContain("Line1\\nLine2");
    expect(out).toContain("\"A\"");
    expect(out).toContain("#96;");
    expect(out).toContain("<");
  });
});

describe("sanitizeMermaidSourceLabels", () => {
  it("wraps flowchart node labels with markdown strings", () => {
    const src = "flowchart LR\nA[\"hello\"]";
    const out = sanitizeMermaidSourceLabels(src);
    expect(out).toContain("A[\"`hello`\"]");
  });

  it("quotes unquoted labels and sanitizes them", () => {
    const src = "flowchart LR\nA[Long label]";
    const out = sanitizeMermaidSourceLabels(src);
    expect(out).toContain('A["`Long label`"]');
  });

  it("wraps edge labels with markdown strings", () => {
    const src = "flowchart LR\nA -->|label| B";
    const out = sanitizeMermaidSourceLabels(src);
    expect(out).toContain("|`label`|");
  });

  it("does not wrap ER edge labels", () => {
    const src = "erDiagram\n  AUTHOR ||--o{ BOOK : writes";
    const out = sanitizeMermaidSourceLabels(src);
    expect(out).toContain(": writes");
  });

  it("can skip edge label wrapping", () => {
    const src = "flowchart LR\nA -->|label| B";
    const out = sanitizeMermaidSourceLabels(src, { wrapEdgeLabels: false });
    expect(out).toContain("|label|");
  });
});
