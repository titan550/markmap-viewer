import { markmapNormalize } from "../core/markmapNormalize";

type TurndownLike = {
  turndown: (html: string) => string;
};

export function looksLikeMarkdown(s: string): boolean {
  const t = (s || "").trim();
  if (!t) return false;
  return (
    /(^|\n)\s{0,3}#{1,6}\s+\S/.test(t) ||
    /(^|\n)\s{0,3}[-*+]\s+\S/.test(t) ||
    /(^|\n)\s{0,3}\d+\.\s+\S/.test(t)
  );
}

export function clipboardToMarkmapMdFromDataTransfer(dt: DataTransfer | null, turndownService: TurndownLike): string {
  const html = dt?.getData("text/html") || "";
  const plain = dt?.getData("text/plain") || "";

  if (looksLikeMarkdown(plain)) return markmapNormalize(plain);

  if (html && html.trim()) {
    try {
      const converted = turndownService.turndown(html);
      const normalized = markmapNormalize(converted);
      if (normalized.trim()) return normalized;
    } catch (e) {
      console.warn("Turndown failed; fallback to plain", e);
    }
  }
  return markmapNormalize(plain);
}

export async function getPasteTextFallback(): Promise<string> {
  try { return (await navigator.clipboard.readText()) || ""; }
  catch { return ""; }
}

export async function getPasteMarkdown(
  dataTransfer: DataTransfer | null,
  turndownService: TurndownLike,
  fallbackOnly = false
): Promise<string> {
  if (!fallbackOnly && dataTransfer) {
    const mdText = clipboardToMarkmapMdFromDataTransfer(dataTransfer, turndownService);
    if (mdText.trim()) return mdText;
  }
  return markmapNormalize(await getPasteTextFallback());
}

export function applyPasteText(
  mdText: string,
  pasteEl: HTMLTextAreaElement,
  onRender: (value: string) => void,
  replaceAll = true
) {
  if (!mdText.trim()) return;

  if (replaceAll) {
    pasteEl.value = mdText;
  } else {
    const start = pasteEl.selectionStart ?? pasteEl.value.length;
    const end = pasteEl.selectionEnd ?? start;
    try { pasteEl.setRangeText(mdText, start, end, "end"); }
    catch { pasteEl.value += mdText; }
  }
  queueMicrotask(() => onRender(pasteEl.value));
}
