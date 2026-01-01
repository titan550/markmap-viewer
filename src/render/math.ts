import { appendInlineToLastListItem, computeSafeIndent, getListContext } from "../core/listContext";
import { parseSvgSize, parseSvgSizeWithUnit, setSvgPixelSize, svgToDataUrl } from "../core/svg";
import type { MarkmapTransformer } from "../types/markmap";

export function renderInlineMarkdown(
  text: string,
  transformer: Pick<MarkmapTransformer, "md"> | null | undefined
): string {
  if (transformer?.md?.renderInline) return transformer.md.renderInline(text);
  const parts = text.split(/(<img[^>]*>)/gi);
  return parts
    .map((part) => {
      if (/^<img/i.test(part)) return part;
      return part
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    })
    .join("");
}

export function shouldRenderInlineMath(expr: string): boolean {
  const trimmed = (expr || "").trim();
  if (!trimmed) return false;
  const currencyLike = /^\d[\d,]*(?:\.\d+)?(?:\s*(?:k|m|b|bn|mm|t))?(?:\s*(?:usd|eur|gbp|cad|aud|jpy|inr))?(?:\s*(?:to|–|-)\s*\d[\d,]*(?:\.\d+)?(?:\s*(?:k|m|b|bn|mm|t))?(?:\s*(?:usd|eur|gbp|cad|aud|jpy|inr))?)?$/i;
  if (currencyLike.test(trimmed)) return false;
  if (/[\\^_{}=]/.test(trimmed)) return true;
  return /[A-Za-z]/.test(trimmed);
}

export async function preRenderMathToImages(
  mdText: string,
  shouldContinue: () => boolean
): Promise<{ mdOut: string } | null> {
  const mathJax = window.MathJax;
  if (!mathJax?.tex2svg) return { mdOut: mdText };
  if (mathJax?.startup?.promise) {
    try { await mathJax.startup.promise; } catch { /* ignore MathJax startup errors */ }
  }
  try { if (document.fonts?.ready) await document.fonts.ready; } catch { /* ignore font readiness errors */ }
  if (!shouldContinue()) return null;

  let out = "";
  let i = 0;
  let inFence = false;
  let fence = "";
  let inInlineCode = false;
  let inlineCodeTicks = 0;

  const isLineStart = (pos: number) => pos === 0 || mdText[pos - 1] === "\n";
  const readLine = (pos: number) => {
    const end = mdText.indexOf("\n", pos);
    return { text: end === -1 ? mdText.slice(pos) : mdText.slice(pos, end), end: end === -1 ? mdText.length : end + 1 };
  };

  const countTickRun = (pos: number) => {
    let n = 0;
    while (mdText[pos + n] === "`") n += 1;
    return n;
  };

  const renderMathImg = async (expr: string, displayMode: boolean, indent: string, matchIndex: number) => {
    if (!displayMode && !shouldRenderInlineMath(expr)) return null;
    let svg = "";
    try {
      const svgNode = mathJax.tex2svg(expr, { display: displayMode });
      const svgEl = svgNode?.querySelector?.("svg");
      svg = svgEl ? svgEl.outerHTML : "";
    } catch (e) {
      console.warn("MathJax render failed; skipping block", e);
      return null;
    }

    if (!svg) return null;

    const basePx = parseFloat(getComputedStyle(document.body).fontSize) || 16;
    const sized = parseSvgSizeWithUnit(svg, basePx);
    const size = sized || parseSvgSize(svg) || { width: 120, height: 40 };
    svg = setSvgPixelSize(svg, size.width, size.height);
    const dataUrl = svgToDataUrl(svg);
    const imgClass = displayMode ? "math-img math-block" : "math-img";
    const img = `<img class="${imgClass}" alt="math" src="${dataUrl}" width="${size.width}" height="${size.height}" style="width:${size.width}px;height:${size.height}px;">`;
    if (displayMode) {
      const listItemMatch = indent.match(/^(\s*(?:[-*+]\s+|\d+\.\s+))/);
      if (listItemMatch) {
        return img;
      }
      const useListCtx = indent.length > 0;
      const listCtx = useListCtx ? getListContext(mdText, matchIndex) : { isList: false, indent: "", childIndent: "" };
      const safeIndent = listCtx.isList ? listCtx.childIndent : computeSafeIndent(indent, mdText, matchIndex);
      if (listCtx.isList) {
        const inlineOut = appendInlineToLastListItem(out, img);
        if (inlineOut !== null) {
          out = inlineOut;
          return "";
        }
        return `${safeIndent}${img}`;
      }
      return `${safeIndent}- ${img}`;
    }
    return img;
  };

  const findClosingDollar = (start: number, isDouble: boolean) => {
    const needle = isDouble ? "$$" : "$";
    for (let pos = start; pos < mdText.length; pos++) {
      if (mdText[pos] === "\\") { pos += 1; continue; }
      if (mdText.startsWith(needle, pos)) return pos;
    }
    return -1;
  };

  while (i < mdText.length) {
    if (!shouldContinue()) return null;

    if (mdText[i] === "`") {
      const run = countTickRun(i);
      if (!inInlineCode) {
        inInlineCode = true;
        inlineCodeTicks = run;
      } else if (run >= inlineCodeTicks) {
        inInlineCode = false;
        inlineCodeTicks = 0;
      }
      out += mdText.slice(i, i + run);
      i += run;
      continue;
    }

    const lineInfo = isLineStart(i) ? readLine(i) : null;
    if (lineInfo && lineInfo.text.trim().startsWith("```")) {
      if (!inFence) {
        inFence = true;
        fence = lineInfo.text.trim().slice(0, 3);
      } else if (lineInfo.text.trim().startsWith(fence)) {
        inFence = false;
        fence = "";
      }
      out += lineInfo.text + "\n";
      i = lineInfo.end;
      continue;
    }

    if (inFence || inInlineCode) {
      out += mdText[i++];
      continue;
    }

    if (mdText.startsWith("$$", i)) {
      const end = findClosingDollar(i + 2, true);
      if (end === -1) {
        out += mdText[i++];
        continue;
      }
      const before = mdText.slice(0, i);
      const indent = before.slice(before.lastIndexOf("\n") + 1).match(/^(\s*)/)?.[1] || "";
      const expr = mdText.slice(i + 2, end).trim();
      const rendered = await renderMathImg(expr, true, indent, i);
      if (!rendered) {
        out += mdText.slice(i, end + 2);
      } else {
        out += rendered;
      }
      i = end + 2;
      continue;
    }

    if (mdText[i] === "$" && mdText[i + 1] !== "$") {
      const end = findClosingDollar(i + 1, false);
      if (end === -1) {
        out += mdText[i++];
        continue;
      }
      const expr = mdText.slice(i + 1, end);
      const rendered = await renderMathImg(expr, false, "", i);
      if (!rendered) {
        out += mdText.slice(i, end + 1);
      } else {
        out += rendered;
      }
      i = end + 1;
      continue;
    }

    out += mdText[i++];
  }

  return { mdOut: out };
}
