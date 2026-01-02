import { markmapNormalize } from "./markmapNormalize";
import { sanitizeMermaidSourceLabels } from "./mermaidSanitize";
import { normalizeNewlines, scanFencedBlocks } from "./fences";

/**
 * Applies all markdown transformations that happen during rendering:
 * 1. markmapNormalize - fixes heading levels, converts paragraphs to headings
 * 2. mermaid sanitization - fixes special characters in mermaid diagrams
 *
 * This allows users to see exactly what will be rendered.
 */
export function autofixMarkdown(mdText: string): string {
  let result = markmapNormalize(mdText);
  const text = normalizeNewlines(result);
  const blocks = scanFencedBlocks(text);
  if (!blocks.length) return result;

  let out = "";
  let lastIndex = 0;
  let touched = false;
  for (const block of blocks) {
    out += text.slice(lastIndex, block.start);
    if (block.lang === "mermaid") {
      const isERDiagram = /^\s*erDiagram\b/m.test(block.content);
      const sanitized = sanitizeMermaidSourceLabels(block.content, {
        lineBreak: "<br/>",
        preserveExisting: true,
        normalizeHtmlEntities: true,
        useNamedColon: true,
        useMarkdownStrings: true,
        wrapEdgeLabels: !isERDiagram,
      });
      const info = block.info ? " " + block.info : "";
      const lineEnd = block.end;
      const hasTrailingNewline = lineEnd > 0 && text[lineEnd - 1] === "\n";
      out += `${block.indent}${block.marker}${info}\n${sanitized}\n${block.indent}${block.marker}${hasTrailingNewline ? "\n" : ""}`;
      touched = true;
    } else {
      out += text.slice(block.start, block.end);
    }
    lastIndex = block.end;
  }

  if (!touched) return result;
  out += text.slice(lastIndex);
  result = out;

  return result;
}
