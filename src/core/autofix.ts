import { markmapNormalize } from "./markmapNormalize";
import { sanitizeMermaidSourceLabels } from "./mermaidSanitize";

/**
 * Applies all markdown transformations that happen during rendering:
 * 1. markmapNormalize - fixes heading levels, converts paragraphs to headings
 * 2. mermaid sanitization - fixes special characters in mermaid diagrams
 *
 * This allows users to see exactly what will be rendered.
 */
export function autofixMarkdown(mdText: string): string {
  let result = markmapNormalize(mdText);

  result = result.replace(
    /^([ \t]*)(```)(mermaid)[ \t]*\n([\s\S]*?)\n\1```/gim,
    (_match, indent, fence, lang, content) => {
      const isERDiagram = /^\s*erDiagram\b/m.test(content);
      const sanitized = sanitizeMermaidSourceLabels(content, {
        lineBreak: "<br/>",
        preserveExisting: true,
        normalizeHtmlEntities: true,
        useNamedColon: true,
        useMarkdownStrings: true,
        wrapEdgeLabels: !isERDiagram,
      });
      return `${indent}${fence}${lang}\n${sanitized}\n${indent}\`\`\``;
    }
  );

  return result;
}
