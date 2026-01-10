import {
  isFenceClosing,
  normalizeNewlines,
  parseFenceOpening,
  unwrapMarkdownContainerFence,
} from "./fences.ts";

export function markmapNormalize(mdText: string): string {
  let s = normalizeNewlines(mdText);
  s = unwrapMarkdownContainerFence(s);
  s = s
    .replace(/^(.+)\n=+\s*$/gm, function (_match, title) {
      return `# ${title.trim()}`;
    })
    .replace(/^(.+)\n-+\s*$/gm, function (_match, title) {
      return `## ${title.trim()}`;
    });

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

  function isFenceLine(line: string): boolean {
    return Boolean(parseFenceOpening(line));
  }

  function matchListItem(line: string): RegExpMatchArray | null {
    return line.match(/^(\s*)(?:[-*+]|\d+\.)\s+/);
  }

  function isListLine(line: string): boolean {
    return Boolean(matchListItem(line));
  }

  function isBlockMathLine(line: string): boolean {
    return line.trim().startsWith("$$");
  }

  // Horizontal rules must use the same character repeated 3+ times (---, ***, ___)
  function isHorizontalRule(line: string): boolean {
    return /^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim());
  }

  function isTableLine(line: string): boolean {
    return /^\s*\|/.test(line);
  }

  function isBlockquoteLine(line: string): boolean {
    return /^\s*>/.test(line);
  }

  function isHtmlBlockLine(line: string): boolean {
    return /^\s*</.test(line);
  }

  function matchHeading(line: string): RegExpMatchArray | null {
    return line.match(/^\s*(#{1,6})\s+/);
  }

  function isHeadingLine(line: string): boolean {
    return Boolean(matchHeading(line));
  }

  function getIndentLength(line: string): number {
    return line.match(/^(\s*)/)?.[1]?.length ?? 0;
  }

  function isBlockElementLine(line: string): boolean {
    return isTableLine(line) || isBlockquoteLine(line) || isHtmlBlockLine(line);
  }

  function isParagraphBoundary(line: string): boolean {
    return (
      isFenceLine(line) ||
      isListLine(line) ||
      isBlockMathLine(line) ||
      isTableLine(line) ||
      isBlockquoteLine(line) ||
      isHtmlBlockLine(line) ||
      isHorizontalRule(line) ||
      isHeadingLine(line)
    );
  }

  // Fence lines may need re-indenting when inside a list context
  function pushFenceLine(line: string): void {
    result.push(fenceIndentPrefix ? fenceIndentPrefix + line.trimStart() : line);
  }

  function resetListContext(): void {
    inListContext = false;
    listContentIndent = 0;
  }

  function shouldSkipBlankLineAfterFence(nextLine: string, nextNextLine: string): boolean {
    if (nextLine.trim()) {
      return false;
    }
    if (!isListLine(nextNextLine)) {
      return false;
    }
    const nextIndent = getIndentLength(nextNextLine);
    return nextIndent <= lastListIndent.length;
  }

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
      if (
        i + 2 < fixedLines.length &&
        shouldSkipBlankLineAfterFence(fixedLines[i + 1], fixedLines[i + 2])
      ) {
        i += 1;
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
    const headingMatch = matchHeading(line);
    if (headingMatch) {
      lastHeadingLevel = headingMatch[1].length;
      lastExplicitHeadingLevel = lastHeadingLevel;
      resetListContext();
      result.push(line);
      continue;
    }

    // Check if line is indented enough to be list continuation
    const lineIndent = getIndentLength(line);
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
        if (isParagraphBoundary(next)) {
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
      const listMatch = matchListItem(line);
      if (listMatch) {
        // Entering or continuing list context
        inListContext = true;
        listContentIndent = listMatch[0].length;
        lastListIndent = listMatch[1];
      } else if (inListContext) {
        // Exit list context if not indented enough (tables/blockquotes/HTML stay in context)
        if (lineIndent < listContentIndent && !isBlockElementLine(line)) {
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
