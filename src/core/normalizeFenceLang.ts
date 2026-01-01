/**
 * Normalize common code fence language aliases to Prism-compatible names.
 * This ensures that aliases like "ts" → "typescript", "py" → "python" work correctly.
 */
export function normalizeFenceLang(md: string): string {
  const map: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    py: "python",
    sh: "bash",
    shell: "bash",
    yml: "yaml",
  };

  // Replace ```<lang> at start of a fence line
  return md.replace(/^```([a-zA-Z0-9_-]+)\s*$/gm, (_match, lang) => {
    const key = lang.toLowerCase();
    const normalized = map[key] || key;
    return "```" + normalized;
  });
}
