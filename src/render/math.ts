import { appendInlineToLastListItem, computeSafeIndent, getListContext } from "../core/listContext";
import { parseSvgSize, parseSvgSizeWithUnit, setSvgPixelSize } from "../core/svg";
import { collectBlobUrls, revokeBlobs } from "./blobs";
import { getRasterScale, svgToPngBlob } from "./images";
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

export async function renderHtmlLineToPng(html: string): Promise<{ blob: Blob; width: number; height: number }> {
  const baseStyle = getComputedStyle(document.body);
  const fontSize = parseFloat(baseStyle.fontSize) || 16;
  const lineHeight = parseFloat(baseStyle.lineHeight);
  const normalizedLineHeight = Number.isFinite(lineHeight) ? lineHeight : Math.round(fontSize * 1.2);
  const baseFont = `${baseStyle.fontStyle} ${baseStyle.fontWeight} ${fontSize}px ${baseStyle.fontFamily}`;
  const codeFont = `${baseStyle.fontStyle} ${baseStyle.fontWeight} ${fontSize}px ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
  const scale = getRasterScale();

  const container = document.createElement("div");
  container.innerHTML = html;
  type TextToken = { type: "text"; text: string; font: string; width?: number };
  type ImgToken = { type: "img"; src: string; width?: number; height?: number };
  const tokens: Array<TextToken | ImgToken> = [];

  const walk = (node: ChildNode, inCode: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text) tokens.push({ type: "text", text, font: inCode ? codeFont : baseFont });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === "img") {
      const width = parseFloat(el.getAttribute("width") || "") || 0;
      const height = parseFloat(el.getAttribute("height") || "") || 0;
      tokens.push({ type: "img", src: el.getAttribute("src") || "", width, height });
      return;
    }
    if (tag === "code") {
      Array.from(el.childNodes).forEach((child) => walk(child, true));
      return;
    }
    if (tag === "br") {
      tokens.push({ type: "text", text: " ", font: inCode ? codeFont : baseFont });
      return;
    }
    Array.from(el.childNodes).forEach((child) => walk(child, inCode));
  };

  Array.from(container.childNodes).forEach((child) => walk(child, false));

  const imgTokens = tokens.filter((token): token is ImgToken => token.type === "img" && !!token.src);
  const imgCache = new Map<string, HTMLImageElement>();
  await Promise.all(
    imgTokens.map((token) => {
      if (imgCache.has(token.src)) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = token.src;
        imgCache.set(token.src, img);
      });
    })
  );

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = baseStyle.color;

  const paddingX = 2;
  const paddingY = 4;
  const imgAscentRatio = 0.8;
  const imgDescentRatio = 0.2;
  let totalWidth = 0;
  let maxAscent = normalizedLineHeight * 0.8;
  let maxDescent = normalizedLineHeight * 0.2;
  for (const token of tokens) {
    if (token.type === "text") {
      ctx.font = token.font;
      const width = ctx.measureText(token.text).width;
      token.width = width;
      const metrics = ctx.measureText(token.text);
      const ascent = Number.isFinite(metrics.actualBoundingBoxAscent)
        ? metrics.actualBoundingBoxAscent
        : normalizedLineHeight * 0.8;
      const descent = Number.isFinite(metrics.actualBoundingBoxDescent)
        ? metrics.actualBoundingBoxDescent
        : normalizedLineHeight * 0.2;
      maxAscent = Math.max(maxAscent, ascent);
      maxDescent = Math.max(maxDescent, descent);
      totalWidth += width;
    } else if (token.type === "img") {
      const img = imgCache.get(token.src);
      const width = token.width || img?.naturalWidth || 0;
      const height = token.height || img?.naturalHeight || 0;
      token.width = width;
      token.height = height;
      totalWidth += width;
      maxAscent = Math.max(maxAscent, height * imgAscentRatio);
      maxDescent = Math.max(maxDescent, height * imgDescentRatio);
    }
  }

  const width = Math.max(1, Math.ceil(totalWidth + paddingX * 2));
  const height = Math.max(1, Math.ceil(maxAscent + maxDescent + paddingY * 2));
  canvas.width = Math.max(1, Math.ceil(width * scale));
  canvas.height = Math.max(1, Math.ceil(height * scale));
  ctx.scale(scale, scale);

  let x = paddingX;
  const baselineY = paddingY + maxAscent;
  for (const token of tokens) {
    if (token.type === "text") {
      ctx.font = token.font;
      ctx.fillStyle = baseStyle.color;
      ctx.fillText(token.text, x, baselineY);
      x += token.width || 0;
    } else if (token.type === "img") {
      const img = imgCache.get(token.src);
      const w = token.width || 0;
      const h = token.height || 0;
      if (img && w > 0 && h > 0) {
        const y = baselineY - h * imgAscentRatio;
        ctx.drawImage(img, x, y, w, h);
      }
      x += w;
    }
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((out) => {
      if (out) resolve(out);
      else reject(new Error("Canvas PNG export failed"));
    }, "image/png");
  });
  return { blob, width, height };
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
): Promise<{ mdOut: string; blobUrls: string[] } | null> {
  const mathJax = window.MathJax;
  if (!mathJax?.tex2svg) return { mdOut: mdText, blobUrls: [] };
  if (mathJax?.startup?.promise) {
    try { await mathJax.startup.promise; } catch { /* ignore MathJax startup errors */ }
  }
  try { if (document.fonts?.ready) await document.fonts.ready; } catch { /* ignore font readiness errors */ }
  if (!shouldContinue()) return null;

  const blobUrls: string[] = [];
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
    const rasterScale = getRasterScale();
    let blob: Blob;
    try {
      blob = await svgToPngBlob(svg, size.width, size.height, rasterScale);
    } catch (e) {
      console.warn("MathJax rasterize failed; skipping block", e);
      return null;
    }
    const url = URL.createObjectURL(blob);
    blobUrls.push(url);
    const imgClass = displayMode ? "math-img math-block" : "math-img";
    const img = `<img class="${imgClass}" alt="math" src="${url}" width="${size.width}" height="${size.height}" style="width:${size.width}px;height:${size.height}px;">`;
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

  return { mdOut: out, blobUrls };
}

export async function preRenderMathLinesToImages(
  mdText: string,
  mathBlobUrls: string[],
  shouldContinue: () => boolean,
  inlineRenderer: (text: string) => string
): Promise<{ mdOut: string; blobUrls: string[] } | null> {
  if (!mdText.includes("math-img")) return { mdOut: mdText, blobUrls: mathBlobUrls || [] };

  const lines = mdText.split("\n");
  const outLines: string[] = [];
  let inFence = false;
  let fence = "";
  const lineBlobUrls: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!inFence) {
      const m = line.match(/^([ \t]*)(```|~~~)/);
      if (m) {
        inFence = true;
        fence = m[2];
        outLines.push(line);
        continue;
      }
    } else {
      if (line.trim().startsWith(fence)) {
        inFence = false;
        fence = "";
      }
      outLines.push(line);
      continue;
    }

    const listMatch = line.match(/^(\s*(?:[-*+]\s+|\d+\.\s+))(.*)$/);
    if (!listMatch) {
      outLines.push(line);
      continue;
    }

    const block: string[] = [];
    let j = i;
    while (j < lines.length) {
      const candidate = lines[j];
      const m = candidate.match(/^(\s*(?:[-*+]\s+|\d+\.\s+))(.*)$/);
      if (!m) break;
      block.push(candidate);
      j += 1;
    }
    i = j - 1;

    const hasInlineMath = block.some((entry) => entry.includes("math-img") && !entry.includes("math-block"));
    if (!hasInlineMath) {
      outLines.push(...block);
      continue;
    }

    for (let bi = 0; bi < block.length; bi += 1) {
      const entry = block[bi];
      const entryMatch = entry.match(/^(\s*(?:[-*+]\s+|\d+\.\s+))(.*)$/);
      if (!entryMatch) {
        outLines.push(entry);
        continue;
      }
      const prefix = entryMatch[1];
      const content = entryMatch[2];
      if (content.includes("math-block")) {
        outLines.push(entry);
        continue;
      }

      let html = "";
      try {
        html = inlineRenderer(content);
      } catch (e) {
        console.warn("Math line markdown render failed; keeping text", e);
        outLines.push(entry);
        continue;
      }

      let rendered: { blob: Blob; width: number; height: number } | null = null;
      try {
        rendered = await renderHtmlLineToPng(html);
      } catch (e) {
        console.warn("Math line rasterize failed; keeping text", e);
        outLines.push(entry);
        continue;
      }

      if (!shouldContinue()) {
        revokeBlobs(lineBlobUrls);
        return null;
      }

      if (!rendered) {
        outLines.push(entry);
        continue;
      }

      const url = URL.createObjectURL(rendered.blob);
      lineBlobUrls.push(url);
      const img = `<img class="math-line-img" alt="math line" src="${url}" width="${rendered.width}" height="${rendered.height}" style="width:${rendered.width}px;height:${rendered.height}px;">`;
      outLines.push(`${prefix}${img}`);
      const nextEntry = block[bi + 1];
      if (nextEntry) {
        const currIndentMatch = entry.match(/^(\s*)/);
        const nextIndentMatch = nextEntry.match(/^(\s*)/);
        const currIndent = currIndentMatch ? currIndentMatch[1].length : 0;
        const nextIndent = nextIndentMatch ? nextIndentMatch[1].length : 0;
        if (nextIndent > currIndent) {
          outLines.push(" ".repeat(currIndent + 2));
        }
      }
    }
  }

  const mdOut = outLines.join("\n");
  const usedUrls = collectBlobUrls(mdOut);
  const usedSet = new Set(usedUrls);
  for (const url of mathBlobUrls || []) {
    if (!usedSet.has(url)) revokeBlobs([url]);
  }
  for (const url of lineBlobUrls) {
    if (!usedSet.has(url)) revokeBlobs([url]);
  }
  return { mdOut, blobUrls: usedUrls };
}
