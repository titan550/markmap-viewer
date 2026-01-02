import { markmapNormalize } from "./markmapNormalize";
import { sanitizeMermaidSourceLabels } from "./mermaidSanitize";
import { normalizeNewlines, scanFencedBlocks } from "./fences";

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
      const hasTrailingNewline = block.end > 0 && text[block.end - 1] === "\n";
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
