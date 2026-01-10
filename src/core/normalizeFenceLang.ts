import { isFenceClosing, normalizeNewlines, parseFenceOpening } from "./fences";

/**
 * Normalize common code fence language aliases to Prism-compatible names.
 * This ensures that aliases like "ts" → "typescript", "py" → "python" work correctly.
 */
const LANG_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  sh: "bash",
  shell: "bash",
  yml: "yaml",
};

export function normalizeFenceLang(md: string): string {
  const text = normalizeNewlines(md);
  const lines = text.split("\n");
  const out: string[] = [];
  let inFence = false;
  let fenceMarkerChar: "`" | "~" | null = null;
  let fenceMarkerLen = 0;

  for (const line of lines) {
    const opening = !inFence ? parseFenceOpening(line) : null;
    if (opening) {
      const tokens = opening.info ? opening.info.split(/\s+/) : [];
      if (tokens.length > 0) {
        const normalizedLang = LANG_ALIASES[opening.lang] || opening.lang;
        const rest = tokens.slice(1).join(" ");
        out.push(`${opening.indent}${opening.marker}${normalizedLang}${rest ? " " + rest : ""}`);
      } else {
        out.push(line);
      }
      inFence = true;
      fenceMarkerChar = opening.markerChar;
      fenceMarkerLen = opening.markerLen;
      continue;
    }

    if (inFence && fenceMarkerChar && isFenceClosing(line, fenceMarkerChar, fenceMarkerLen)) {
      inFence = false;
      fenceMarkerChar = null;
      fenceMarkerLen = 0;
      out.push(line);
      continue;
    }

    out.push(line);
  }

  return out.join("\n");
}
