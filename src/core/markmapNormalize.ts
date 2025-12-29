export function markmapNormalize(mdText: string): string {
  let s = (mdText || "").replace(/\r\n/g, "\n");
  const trimmed = s.trim();
  const fenced = trimmed.match(/^```(?:markdown|md)\s*\n([\s\S]*?)\n```$/);
  if (fenced) s = fenced[1];
  s = s
    .replace(/^(.+)\n=+\s*$/gm, (_, t) => `# ${t.trim()}`)
    .replace(/^(.+)\n-+\s*$/gm, (_, t) => `## ${t.trim()}`);

  const fixedLines = s.split("\n");
  const result: string[] = [];
  let lastHeadingLevel = 3;
  let lastExplicitHeadingLevel = 3;
  let prevNonEmptyWasList = false;
  let inFence = false;
  let fenceMarker: string | null = null;
  let inMathBlock = false;

  const isFenceLine = (line: string) => /^\s*(```+|~~~+)/.test(line);
  const isListLine = (line: string) => /^(\s*)(?:[-*+]|[0-9]+\.)\s+/.test(line);
  const isBlockMathLine = (line: string) => line.trim().startsWith("$$");
  const isHorizontalRule = (line: string) => /^([-*_]){3,}\s*$/.test(line.trim());
  const isTableLine = (line: string) => /^\s*\|/.test(line);
  const isBlockquoteLine = (line: string) => /^\s*>/.test(line);
  const isHtmlBlockLine = (line: string) => /^\s*</.test(line);

  for (let i = 0; i < fixedLines.length; i++) {
    const line = fixedLines[i];

    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (fenceMarker && line.trim().startsWith(fenceMarker)) {
        inFence = false;
        fenceMarker = null;
      }
      result.push(line);
      prevNonEmptyWasList = false;
      continue;
    }

    if (inFence) {
      result.push(line);
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
    }
  }

  s = result.join("\n");

  // Convert loose lists to tight lists by removing blank lines between list items
  // This prevents Safari foreignObject rendering issues with <p> tags
  s = s.replace(/^(\s*(?:[-*+]|\d+\.)\s+.*)$\n\n(?=\s*(?:[-*+]|\d+\.)\s+)/gm, "$1\n");
  // Also handle: fence close followed by blank line before list item
  s = s.replace(/^(\s*```)\n\n(?=\s*(?:[-*+]|\d+\.)\s+)/gm, "$1\n");

  return s.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
