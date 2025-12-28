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
    expect(out).toContain("A[\"hello\"]");
  });

  it("quotes unquoted labels and sanitizes them", () => {
    const src = "flowchart LR\nA[Long label]";
    const out = sanitizeMermaidSourceLabels(src);
    expect(out).toContain('A["Long label"]');
  });

  it("wraps edge labels with markdown strings", () => {
    const src = "flowchart LR\nA -->|label| B";
    const out = sanitizeMermaidSourceLabels(src);
    expect(out).toContain("|label|");
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

  it("normalizes diamond labels with quoted markdown strings", () => {
    const src = "flowchart LR\nA{\"`Uncertain?`\"}";
    const out = sanitizeMermaidSourceLabels(src);
    expect(out).toContain('A{"Uncertain?"}');
  });

  it("decodes entity escapes in flowchart labels", () => {
    const src = "flowchart LR\nA[\"`1#41; Plan\\nline`\"]";
    const out = sanitizeMermaidSourceLabels(src);
    expect(out).toContain("1) Plan<br/>line");
  });

  it("sanitizes sequence diagram message labels", () => {
    const src = "sequenceDiagram\nA->>B: \"`Line1\\nLine2 #32;`\"";
    const out = sanitizeMermaidSourceLabels(src);
    expect(out).toContain(": \"Line1<br/>Line2  \"");
  });

  it("sanitizes state diagram edge labels", () => {
    const src = "stateDiagram-v2\nBuild --> Assess: \"tests#47;reviews\"";
    const out = sanitizeMermaidSourceLabels(src);
    expect(out).toContain(": \"tests/reviews\"");
  });

  it("preserves quoted stadium labels with markdown strings", () => {
    const src = "flowchart LR\nSTART([\"`Hello`\"])\n";
    const out = sanitizeMermaidSourceLabels(src);
    expect(out).toContain("START([\"Hello\"])");
  });
});
