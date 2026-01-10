/**
 * Extract title from markdown for display in history list.
 */

const HEADING_REGEX = /^(#{1,6})\s+(.+)$/m;
const MAX_TITLE_LENGTH = 50;

/**
 * Extract title from markdown.
 * Priority:
 * 1. First heading (# or ##, etc.)
 * 2. First non-empty line
 * 3. "Untitled"
 */
export function extractTitle(markdown: string): string {
  const trimmed = markdown.trim();
  if (!trimmed) return "Untitled";

  // Try to find a heading
  const headingMatch = trimmed.match(HEADING_REGEX);
  if (headingMatch) {
    return truncateTitle(headingMatch[2].trim());
  }

  // Fall back to first non-empty line
  const lines = trimmed.split("\n");
  for (const line of lines) {
    const cleaned = line.trim();
    if (cleaned) {
      // Remove markdown formatting from first line
      const withoutFormatting = cleaned
        .replace(/^[-*+]\s+/, "") // List markers
        .replace(/^\d+\.\s+/, "") // Numbered lists
        .replace(/^>\s+/, "") // Blockquotes
        .replace(/\*\*(.+?)\*\*/g, "$1") // Bold
        .replace(/\*(.+?)\*/g, "$1") // Italic
        .replace(/`(.+?)`/g, "$1") // Inline code
        .replace(/\[(.+?)\]\(.+?\)/g, "$1") // Links
        .trim();
      if (withoutFormatting) {
        return truncateTitle(withoutFormatting);
      }
    }
  }

  return "Untitled";
}

/**
 * Truncate title to max length with ellipsis.
 */
export function truncateTitle(title: string, maxLength = MAX_TITLE_LENGTH): string {
  if (title.length <= maxLength) return title;
  return title.slice(0, maxLength - 1).trim() + "…";
}
