import { isFenceClosing, normalizeNewlines, parseFenceOpening, unwrapMarkdownContainerFence } from "./fences";

export function markmapNormalize(mdText: string): string {
  let s = normalizeNewlines(mdText);
  s = unwrapMarkdownContainerFence(s);
  s = s
    .replace(/^(.+)\n=+\s*$/gm, (_, t) => `# ${t.trim()}`)
    .replace(/^(.+)\n-+\s*$/gm, (_, t) => `## ${t.trim()}`);

  const fixedLines = s.split("\n");
  const result: string[] = [];
  let lastHeadingLevel = 3;
  let lastExplicitHeadingLevel = 3;
  let inListContext = false;
  let listContentIndent = 0;
  let lastListIndent = "";
  let inFence = false;
  let fenceMarkerChar: "`" | "~" | null = null;
  let fenceMarkerLen = 0;
  let fenceIndentPrefix: string | null = null;
  let inMathBlock = false;

  const isFenceLine = (line: string) => Boolean(parseFenceOpening(line));
  const isListLine = (line: string) => /^(\s*)(?:[-*+]|[0-9]+\.)\s+/.test(line);
  const isBlockMathLine = (line: string) => line.trim().startsWith("$$");
  // Horizontal rules must use the same character repeated 3+ times (---, ***, ___)
  const isHorizontalRule = (line: string) => /^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim());
  const isTableLine = (line: string) => /^\s*\|/.test(line);
  const isBlockquoteLine = (line: string) => /^\s*>/.test(line);
  const isHtmlBlockLine = (line: string) => /^\s*</.test(line);

  // Fence lines may need re-indenting when inside a list context
  const pushFenceLine = (line: string): void => {
    result.push(fenceIndentPrefix ? fenceIndentPrefix + line.trimStart() : line);
  };

  const resetListContext = (): void => {
    inListContext = false;
    listContentIndent = 0;
  };

  for (let i = 0; i < fixedLines.length; i++) {
    const line = fixedLines[i];

    const fenceOpen = parseFenceOpening(line);
    if (!inFence && fenceOpen) {
      if (inListContext && fenceOpen.indent.length <= 3) {
        const childIndent = lastListIndent + "  ";
        if (!fenceOpen.indent.startsWith(childIndent)) {
          fenceIndentPrefix = childIndent;
        }
      }
      inFence = true;
      fenceMarkerChar = fenceOpen.markerChar;
      fenceMarkerLen = fenceOpen.markerLen;
      pushFenceLine(line);
      continue;
    }

    if (inFence && fenceMarkerChar && isFenceClosing(line, fenceMarkerChar, fenceMarkerLen)) {
      inFence = false;
      fenceMarkerChar = null;
      fenceMarkerLen = 0;
      pushFenceLine(line);
      fenceIndentPrefix = null;
      if (i + 2 < fixedLines.length && !fixedLines[i + 1].trim() && isListLine(fixedLines[i + 2])) {
        const nextIndent = fixedLines[i + 2].match(/^(\s*)/)?.[1]?.length ?? 0;
        // Only skip blank line for same-level or parent list items
        if (nextIndent <= lastListIndent.length) {
          i += 1;
        }
      }
      continue;
    }

    if (inFence) {
      pushFenceLine(line);
      continue;
    }

    if (/^\s*\$\$\s*$/.test(line)) {
      inMathBlock = !inMathBlock;
      result.push(line);
      continue;
    }

    if (inMathBlock) {
      result.push(line);
      continue;
    }

    // Allow optional leading whitespace for indented headings
    const headingMatch = line.match(/^\s*(#{1,6})\s+/);
    if (headingMatch) {
      lastHeadingLevel = headingMatch[1].length;
      lastExplicitHeadingLevel = lastHeadingLevel;
      resetListContext();
      result.push(line);
      continue;
    }

    // Check if line is indented enough to be list continuation
    const lineIndent = line.match(/^(\s*)/)?.[1]?.length ?? 0;
    const isListContinuation = inListContext && lineIndent >= listContentIndent;

    const isFreeformLine =
      line.trim() &&
      !isListLine(line) &&
      !isBlockMathLine(line) &&
      !isTableLine(line) &&
      !isBlockquoteLine(line) &&
      !isHtmlBlockLine(line) &&
      !isHorizontalRule(line) &&
      !isListContinuation;

    if (isFreeformLine) {
      let para = line.trim();
      let j = i + 1;
      while (j < fixedLines.length) {
        const next = fixedLines[j];
        if (!next.trim()) break;
        if (
          isFenceLine(next) ||
          isListLine(next) ||
          isBlockMathLine(next) ||
          isTableLine(next) ||
          isBlockquoteLine(next) ||
          isHtmlBlockLine(next) ||
          isHorizontalRule(next) ||
          next.match(/^\s*(#{1,6})\s+/)
        ) {
          break;
        }
        para += " " + next.trim();
        j++;
      }

      const level = Math.min(lastExplicitHeadingLevel + 1, 6);
      result.push("#".repeat(level) + " " + para);
      lastHeadingLevel = level;
      resetListContext();
      i = j - 1;
      continue;
    }

    result.push(line);
    if (line.trim()) {
      const listMatch = line.match(/^(\s*)(?:[-*+]|\d+\.)\s+/);
      if (listMatch) {
        // Entering or continuing list context
        inListContext = true;
        listContentIndent = listMatch[0].length;
        lastListIndent = listMatch[1];
      } else if (inListContext) {
        // Exit list context if not indented enough (tables/blockquotes/HTML stay in context)
        const isBlockElement = isTableLine(line) || isBlockquoteLine(line) || isHtmlBlockLine(line);
        if (lineIndent < listContentIndent && !isBlockElement) {
          resetListContext();
        }
      }
    }
  }

  s = result.join("\n");

  // Convert loose lists to tight lists by removing blank lines between list items
  // This prevents Safari foreignObject rendering issues with <p> tags
  s = s.replace(/^(\s*(?:[-*+]|\d+\.)\s+.*)$\n\n(?=\s*(?:[-*+]|\d+\.)\s+)/gm, "$1\n");
  // Only trim trailing whitespace to preserve leading indentation on first line
  return s.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
