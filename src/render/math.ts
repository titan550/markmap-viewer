import { appendInlineToLastListItem, computeSafeIndent, getListContext } from "../core/listContext";
import { isFenceClosing, parseFenceOpening } from "../core/fences";
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
      return part.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    })
    .join("");
}

export function shouldRenderInlineMath(expr: string): boolean {
  const trimmed = (expr || "").trim();
  if (!trimmed) return false;
  const currencyLike =
    /^\d[\d,]*(?:\.\d+)?(?:\s*(?:k|m|b|bn|mm|t))?(?:\s*(?:usd|eur|gbp|cad|aud|jpy|inr))?(?:\s*(?:to|–|-)\s*\d[\d,]*(?:\.\d+)?(?:\s*(?:k|m|b|bn|mm|t))?(?:\s*(?:usd|eur|gbp|cad|aud|jpy|inr))?)?$/i;
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
  const mathJaxApi = mathJax;
  const startupReady = mathJaxApi.startup?.promise;
  if (startupReady) {
    await startupReady.catch(() => undefined);
  }
  const fontsReady = document.fonts?.ready;
  if (fontsReady) {
    await fontsReady.catch(() => undefined);
  }
  if (!shouldContinue()) return null;

  let out = "";
  let i = 0;
  let inFence = false;
  let fenceMarkerChar: "`" | "~" | null = null;
  let fenceMarkerLen = 0;
  let inInlineCode = false;
  let inlineCodeTicks = 0;

  function isLineStart(pos: number): boolean {
    return pos === 0 || mdText[pos - 1] === "\n";
  }

  function readLine(pos: number): { text: string; end: number } {
    const end = mdText.indexOf("\n", pos);
    return {
      text: end === -1 ? mdText.slice(pos) : mdText.slice(pos, end),
      end: end === -1 ? mdText.length : end + 1,
    };
  }

  function countTickRun(pos: number): number {
    let n = 0;
    while (mdText[pos + n] === "`") n += 1;
    return n;
  }

  async function renderMathImg(
    expr: string,
    displayMode: boolean,
    indent: string,
    matchIndex: number
  ): Promise<string | null> {
    if (!displayMode && !shouldRenderInlineMath(expr)) return null;
    let svg = "";
    try {
      const svgNode = mathJaxApi.tex2svg(expr, { display: displayMode });
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
      const listCtx = useListCtx
        ? getListContext(mdText, matchIndex)
        : { isList: false, indent: "", childIndent: "" };
      const safeIndent = listCtx.isList
        ? listCtx.childIndent
        : computeSafeIndent(indent, mdText, matchIndex);
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
  }

  function findClosingDollar(start: number, isDouble: boolean): number {
    const needle = isDouble ? "$$" : "$";
    for (let pos = start; pos < mdText.length; pos++) {
      if (mdText[pos] === "\\") {
        pos += 1;
        continue;
      }
      if (mdText.startsWith(needle, pos)) return pos;
    }
    return -1;
  }

  while (i < mdText.length) {
    if (!shouldContinue()) return null;

    const lineInfo = isLineStart(i) ? readLine(i) : null;
    if (lineInfo && !inInlineCode) {
      const lineHasNewline = lineInfo.end <= mdText.length && mdText[lineInfo.end - 1] === "\n";
      if (!inFence) {
        const opening = parseFenceOpening(lineInfo.text);
        if (opening) {
          inFence = true;
          fenceMarkerChar = opening.markerChar;
          fenceMarkerLen = opening.markerLen;
          out += lineInfo.text + (lineHasNewline ? "\n" : "");
          i = lineInfo.end;
          continue;
        }
      } else if (
        fenceMarkerChar &&
        isFenceClosing(lineInfo.text, fenceMarkerChar, fenceMarkerLen)
      ) {
        inFence = false;
        fenceMarkerChar = null;
        fenceMarkerLen = 0;
        out += lineInfo.text + (lineHasNewline ? "\n" : "");
        i = lineInfo.end;
        continue;
      } else if (inFence) {
        out += lineInfo.text + (lineHasNewline ? "\n" : "");
        i = lineInfo.end;
        continue;
      }
    }

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
