import { appendInlineToLastListItem, computeSafeIndent, getListContext } from "../core/listContext";
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
  const re = /^([ \t]*)```([A-Za-z0-9_-]+)(?:[ \t]+([A-Za-z0-9_-]+))?[ \t]*\n([\s\S]*?)\n\1```/gmi;
  let out = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const blobUrls: string[] = [];

  while ((match = re.exec(mdText)) !== null) {
    out += mdText.slice(lastIndex, match.index);
    const indent = match[1] || "";
    const lang = (match[2] || "").toLowerCase();
    const hint = (match[3] || "").toLowerCase();
    const raw = match[4] || "";
    const renderer = renderers[lang];
    const listCtx = getListContext(mdText, match.index);
    const safeIndent = listCtx.isList ? listCtx.childIndent : computeSafeIndent(indent, mdText, match.index);

    if (!renderer) {
      out += match[0];
      lastIndex = re.lastIndex;
      continue;
    }

    if (!shouldContinue()) {
      revokeBlobs(blobUrls);
      return null;
    }

    let rendered: RenderResult | null = null;
    try {
      rendered = await renderer.render(raw, { mdText, matchIndex: match.index, token: currentToken, formatHint: hint });
    } catch (e) {
      const firstLine = raw.split("\n").find((line) => line.trim()) || "";
      console.warn(`${renderer.name} render failed; skipping block`, firstLine, e);
      out += match[0];
      lastIndex = re.lastIndex;
      continue;
    }

    if (!rendered || !shouldContinue()) {
      revokeBlobs(blobUrls);
      return null;
    }

    const { mime, data, width, height, className, alt } = rendered;
    if (!mime || !data) {
      out += match[0];
      lastIndex = re.lastIndex;
      continue;
    }

    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    blobUrls.push(url);
    const finalWidth = Number.isFinite(width) && width > 0 ? Math.ceil(width) : 480;
    const finalHeight = Number.isFinite(height) && height > 0 ? Math.ceil(height) : 240;
    const imgClass = className || "diagram-img";
    const imgAlt = alt || `${renderer.name} diagram`;
    const imgHtml = `<img class="${imgClass}" alt="${imgAlt}" src="${url}" width="${finalWidth}" height="${finalHeight}" style="width:${finalWidth}px;height:${finalHeight}px;">`;
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
    lastIndex = re.lastIndex;
  }

  out += mdText.slice(lastIndex);
  return { mdOut: out, blobUrls };
}
