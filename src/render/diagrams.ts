import { appendInlineToLastListItem, computeSafeIndent, getListContext } from "../core/listContext";
import { normalizeNewlines, scanFencedBlocks } from "../core/fences";
import { revokeBlobs } from "./blobs";
import { dotRenderer } from "../renderers/dot";
import { mermaidRenderer } from "../renderers/mermaid";
import { vegaLiteRenderer } from "../renderers/vegaLite";
import { wavedromRenderer } from "../renderers/wavedrom";
import type { Renderer, RenderResult } from "../renderers/types";

const renderers: Record<string, Renderer> = {
  mermaid: mermaidRenderer,
  dot: dotRenderer,
  graphviz: dotRenderer,
  gv: dotRenderer,
  wavedrom: wavedromRenderer,
  wave: wavedromRenderer,
  wavejson: wavedromRenderer,
  "vega-lite": vegaLiteRenderer,
  vl: vegaLiteRenderer,
};

export async function preRenderDiagramFencesToImages(
  mdText: string,
  currentToken: number,
  shouldContinue: () => boolean
): Promise<{ mdOut: string; blobUrls: string[] } | null> {
  const text = normalizeNewlines(mdText);
  const blocks = scanFencedBlocks(text);
  let out = "";
  let lastIndex = 0;
  const blobUrls: string[] = [];

  for (const block of blocks) {
    out += text.slice(lastIndex, block.start);
    const indent = block.indent;
    const lang = block.lang;
    const hint = (block.hint || "").toLowerCase();
    const raw = block.content;
    const renderer = renderers[lang];
    const listCtx = getListContext(text, block.start);
    const safeIndent = listCtx.isList ? listCtx.childIndent : computeSafeIndent(indent, text, block.start);

    if (!renderer) {
      out += text.slice(block.start, block.end);
      lastIndex = block.end;
      continue;
    }

    if (!shouldContinue()) {
      revokeBlobs(blobUrls);
      return null;
    }

    let rendered: RenderResult | null = null;
    try {
      rendered = await renderer.render(raw, { mdText: text, matchIndex: block.start, token: currentToken, formatHint: hint });
    } catch (e) {
      const firstLine = raw.split("\n").find((line) => line.trim()) || "";
      console.warn(`${renderer.name} render failed; skipping block`, firstLine, e);
      out += text.slice(block.start, block.end);
      lastIndex = block.end;
      continue;
    }

    if (!rendered || !shouldContinue()) {
      revokeBlobs(blobUrls);
      return null;
    }

    const { mime, data, width, height, className, alt } = rendered;
    if (!mime || !data) {
      out += text.slice(block.start, block.end);
      lastIndex = block.end;
      continue;
    }

    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    blobUrls.push(url);
    const finalWidth = Number.isFinite(width) && width > 0 ? Math.ceil(width) : 480;
    const finalHeight = Number.isFinite(height) && height > 0 ? Math.ceil(height) : 240;
    const imgClass = className || "diagram-img";
    const imgAlt = alt || `${renderer.name} diagram`;
    // No position:absolute - Safari renders positioned elements at SVG root in foreignObject
    const wrapStyle = `display:inline-block;width:${finalWidth}px;height:${finalHeight}px;line-height:0;vertical-align:top;`;
    const imgStyle = `display:block;width:${finalWidth}px;height:${finalHeight}px;`;
    const imgHtml = `<span class="diagram-wrap" style="${wrapStyle}"><img class="${imgClass}" alt="${imgAlt}" src="${url}" width="${finalWidth}" height="${finalHeight}" style="${imgStyle}"></span>`;
    if (listCtx.isList) {
      const inlineOut = appendInlineToLastListItem(out, imgHtml);
      if (inlineOut !== null) {
        out = inlineOut;
      } else {
        out += `${safeIndent}${imgHtml}`;
      }
    } else {
      out += `${safeIndent}- ${imgHtml}`;
    }
    lastIndex = block.end;
  }

  out += text.slice(lastIndex);
  return { mdOut: out, blobUrls };
}
