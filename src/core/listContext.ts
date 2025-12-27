export function computeSafeIndent(indent: string, mdText: string, matchIndex: number): string {
  if (indent.length < 4) return indent;
  const before = mdText.slice(0, matchIndex);
  const lines = before.split("\n");
  for (let k = lines.length - 1; k >= 0; k--) {
    const line = lines[k];
    if (!line.trim()) continue;
    if (/^\s*([-*+]\s+|\d+\.\s+)/.test(line)) return indent;
    break;
  }
  return indent.slice(0, 3);
}

export type ListContext = {
  isList: boolean;
  indent: string;
  childIndent: string;
};

export function getListContext(mdText: string, matchIndex: number): ListContext {
  const before = mdText.slice(0, matchIndex);
  const lines = before.split("\n");
  for (let k = lines.length - 1; k >= 0; k--) {
    const line = lines[k];
    if (!line.trim()) continue;
    const m = line.match(/^(\s*)(?:[-*+]\s+|\d+\.\s+)/);
    if (m) {
      const indent = m[1] || "";
      return { isList: true, indent, childIndent: indent + "  " };
    }
    break;
  }
  return { isList: false, indent: "", childIndent: "" };
}

export function appendInlineToLastListItem(out: string, html: string): string | null {
  let end = out.length;
  let idx = out.lastIndexOf("\n");
  while (idx >= 0) {
    const line = out.slice(idx + 1, end);
    if (!line.trim()) {
      end = idx;
      idx = out.lastIndexOf("\n", idx - 1);
      continue;
    }
    if (/^\s*(?:[-*+]\s+|\d+\.\s+)[^\n]*$/.test(line)) {
      return out.slice(0, idx + 1) + line + " " + html;
    }
    return null;
  }
  if (/^\s*(?:[-*+]\s+|\d+\.\s+)[^\n]*$/.test(out)) {
    return out + " " + html;
  }
  return null;
}
