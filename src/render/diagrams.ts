import { normalizeNewlines, scanFencedBlocks } from "../core/fences";
import { appendInlineToLastListItem, computeSafeIndent, getListContext } from "../core/listContext";
import { sanitizeSvgForXml } from "../core/svgSanitize";
import { dotRenderer } from "../renderers/dot";
import { mermaidRenderer } from "../renderers/mermaid";
import type { RenderResult, Renderer } from "../renderers/types";
import { vegaLiteRenderer } from "../renderers/vegaLite";
import { wavedromRenderer } from "../renderers/wavedrom";
import { revokeBlobs } from "./blobs";

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

function resolveDimension(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.ceil(value);
}

function buildDiagramImageHtml(options: {
  url: string;
  width: number;
  height: number;
  className: string;
  alt: string;
}): string {
  const { url, width, height, className, alt } = options;
  // No position:absolute - Safari renders positioned elements at SVG root in foreignObject
  const wrapStyle = `display:inline-block;width:${width}px;height:${height}px;line-height:0;vertical-align:top;`;
  const imgStyle = `display:block;width:${width}px;height:${height}px;`;
  return `<span class="diagram-wrap" style="${wrapStyle}"><img class="${className}" alt="${alt}" src="${url}" width="${width}" height="${height}" style="${imgStyle}"></span>`;
}

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

    const renderContext = {
      mdText: text,
      matchIndex: block.start,
      token: currentToken,
      formatHint: hint,
    };
    let rendered: RenderResult | null = null;
    try {
      rendered = await renderer.render(raw, renderContext);
    } catch (error) {
      const firstLine = raw.split("\n").find((line) => line.trim()) || "";
      console.warn(`${renderer.name} render failed; skipping block`, firstLine, error);
      out += text.slice(block.start, block.end);
      lastIndex = block.end;
      continue;
    }

    if (!rendered || !shouldContinue()) {
      revokeBlobs(blobUrls);
      return null;
    }

    const { mime, width, height, className, alt } = rendered;
    let { data } = rendered;
    if (!mime || !data) {
      out += text.slice(block.start, block.end);
      lastIndex = block.end;
      continue;
    }

    if (mime === "image/svg+xml" && typeof data === "string") {
      data = sanitizeSvgForXml(data);
    }

    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    blobUrls.push(url);
    const finalWidth = resolveDimension(width, 480);
    const finalHeight = resolveDimension(height, 240);
    const imgClass = className || "diagram-img";
    const imgAlt = alt || `${renderer.name} diagram`;
    const imgHtml = buildDiagramImageHtml({
      url,
      width: finalWidth,
      height: finalHeight,
      className: imgClass,
      alt: imgAlt,
    });
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
