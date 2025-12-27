export function markmapNormalize(mdText: string): string {
  let s = (mdText || "").replace(/\r\n/g, "\n");
  const trimmed = s.trim();
  const fenced = trimmed.match(/^```(?:markdown|md)\s*\n([\s\S]*?)\n```$/);
  if (fenced) s = fenced[1];
  s = s
    .replace(/^(.+)\n=+\s*$/gm, (_, t) => `# ${t.trim()}`)
    .replace(/^(.+)\n-+\s*$/gm, (_, t) => `## ${t.trim()}`);

  const isDiagramFence = (line: string) =>
    /^```(?:mermaid|dot|graphviz|gv|wavedrom|wave|wavejson|vega-lite|vl)\b/.test(line);
  const isTopLevelDiagramFence = (line: string) =>
    isDiagramFence(line.trim()) && line.trim() === line;

  const fixedLines = s.split("\n");
  const result: string[] = [];
  let lastHeadingLevel = 3;
  let lastExplicitHeadingLevel = 3;
  let needsSeparatorForList = false;
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
    const nextLine = fixedLines[i + 1] || "";

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

      let hasListAfter = false;
      let hasMermaidAfter = false;

      for (let j = i + 1; j < fixedLines.length; j++) {
        const rawCheckLine = fixedLines[j];
        const checkLine = rawCheckLine.trim();
        if (checkLine === "") continue;

        if (checkLine.match(/^[-*+]\s+/)) {
          hasListAfter = true;
        } else if (isTopLevelDiagramFence(rawCheckLine) && hasListAfter) {
          hasMermaidAfter = true;
          break;
        } else if (checkLine.match(/^#{1,6}\s+/)) {
          break;
        }
      }

      result.push(line);

      if (hasListAfter && hasMermaidAfter) {
        needsSeparatorForList = true;
        result.push("");
        const separatorLevel = Math.min(lastHeadingLevel + 1, 6);
        result.push("#".repeat(separatorLevel) + " Details");
        result.push("");
      } else if (hasListAfter) {
        if (nextLine.match(/^[-*+]\s+/)) {
          result.push("");
        }
      }
      continue;
    }

    const listMatch = line.match(/^(\s*)[-*+]\s+/);
    if (listMatch && needsSeparatorForList) {
      result.push(line);
      prevNonEmptyWasList = true;
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
      needsSeparatorForList = false;
      prevNonEmptyWasList = false;
      i = j - 1;
      continue;
    }

    if (needsSeparatorForList && isTopLevelDiagramFence(line)) {
      const separatorLevel = Math.min(lastHeadingLevel + 1, 6);
      result.push("");
      result.push("#".repeat(separatorLevel) + " Diagram");
      result.push("");
      needsSeparatorForList = false;
    }

    result.push(line);
    if (line.trim()) {
      prevNonEmptyWasList = isListLine(line);
    }
  }

  s = result.join("\n");
  return s.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
