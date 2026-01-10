/**
 * SHA-256 hashing for content deduplication.
 */

/**
 * Compute SHA-256 hash of text.
 */
export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Normalize text before hashing to reduce false negatives.
 * - Trim whitespace
 * - Normalize line endings
 * - Collapse multiple blank lines
 */
export function normalizeForHash(text: string): string {
  return text
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

/**
 * Compute hash of normalized text.
 */
export async function hashMarkdown(text: string): Promise<string> {
  return sha256(normalizeForHash(text));
}
