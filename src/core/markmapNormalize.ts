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
  let prevNonEmptyWasList = false;
  let lastListIndent = "";
  let inFence = false;
  let fenceMarkerChar: "`" | "~" | null = null;
  let fenceMarkerLen = 0;
  let fenceIndentPrefix: string | null = null;
  let inMathBlock = false;

  const isFenceLine = (line: string) => Boolean(parseFenceOpening(line));
  const isListLine = (line: string) => /^(\s*)(?:[-*+]|[0-9]+\.)\s+/.test(line);
  const isBlockMathLine = (line: string) => line.trim().startsWith("$$");
  const isHorizontalRule = (line: string) => /^([-*_]){3,}\s*$/.test(line.trim());
  const isTableLine = (line: string) => /^\s*\|/.test(line);
  const isBlockquoteLine = (line: string) => /^\s*>/.test(line);
  const isHtmlBlockLine = (line: string) => /^\s*</.test(line);

  for (let i = 0; i < fixedLines.length; i++) {
    const line = fixedLines[i];

    const fenceOpen = parseFenceOpening(line);
    if (!inFence && fenceOpen) {
      if (prevNonEmptyWasList && fenceOpen.indent.length <= 3) {
        const childIndent = lastListIndent + "  ";
        if (!fenceOpen.indent.startsWith(childIndent)) {
          fenceIndentPrefix = childIndent;
        }
      }
      inFence = true;
      fenceMarkerChar = fenceOpen.markerChar;
      fenceMarkerLen = fenceOpen.markerLen;
      result.push(fenceIndentPrefix ? fenceIndentPrefix + line : line);
      prevNonEmptyWasList = false;
      continue;
    }

    if (inFence && fenceMarkerChar && isFenceClosing(line, fenceMarkerChar, fenceMarkerLen)) {
      inFence = false;
      fenceMarkerChar = null;
      fenceMarkerLen = 0;
      result.push(fenceIndentPrefix ? fenceIndentPrefix + line : line);
      fenceIndentPrefix = null;
      prevNonEmptyWasList = false;
      if (i + 2 < fixedLines.length && !fixedLines[i + 1].trim() && isListLine(fixedLines[i + 2])) {
        i += 1;
      }
      continue;
    }

    if (inFence) {
      result.push(fenceIndentPrefix ? fenceIndentPrefix + line : line);
      prevNonEmptyWasList = false;
      continue;
    }

    if (/^\s*\$\$\s*$/.test(line)) {
      inMathBlock = !inMathBlock;
      result.push(line);
      prevNonEmptyWasList = false;
      continue;
    }

    if (inMathBlock) {
      result.push(line);
      prevNonEmptyWasList = false;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+/);
    if (headingMatch) {
      lastHeadingLevel = headingMatch[1].length;
      lastExplicitHeadingLevel = lastHeadingLevel;
      prevNonEmptyWasList = false;
      result.push(line);
      continue;
    }

    const isFreeformLine =
      line.trim() &&
      !isListLine(line) &&
      !isBlockMathLine(line) &&
      !isTableLine(line) &&
      !isBlockquoteLine(line) &&
      !isHtmlBlockLine(line) &&
      !isHorizontalRule(line) &&
      !(prevNonEmptyWasList && /^\s{2,}\S/.test(line));

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
          next.match(/^(#{1,6})\s+/)
        ) {
          break;
        }
        para += " " + next.trim();
        j++;
      }

      const level = Math.min(lastExplicitHeadingLevel + 1, 6);
      result.push("#".repeat(level) + " " + para);
      lastHeadingLevel = level;
      prevNonEmptyWasList = false;
      i = j - 1;
      continue;
    }

    result.push(line);
    if (line.trim()) {
      prevNonEmptyWasList = isListLine(line);
      if (prevNonEmptyWasList) {
        lastListIndent = line.match(/^(\s*)/)?.[1] || "";
      }
    }
  }

  s = result.join("\n");

  // Convert loose lists to tight lists by removing blank lines between list items
  // This prevents Safari foreignObject rendering issues with <p> tags
  s = s.replace(/^(\s*(?:[-*+]|\d+\.)\s+.*)$\n\n(?=\s*(?:[-*+]|\d+\.)\s+)/gm, "$1\n");
  return s.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
