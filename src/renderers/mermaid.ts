import { sanitizeMermaidSourceLabels } from "../core/mermaidSanitize";
import { injectSvgStyle, parseSvgSize } from "../core/svg";
import type { Renderer } from "./types";

let mermaidInitialized = false;
let mermaidId = 0;

function ensureMermaidInit() {
  if (mermaidInitialized) return;
  const mermaid = window.mermaid;
  if (!mermaid) throw new Error("Mermaid is not available");
  mermaid.initialize({
    startOnLoad: false,
    htmlLabels: false,
    markdownAutoWrap: false,
    wrap: false,
    flowchart: {
      htmlLabels: false,
      useMaxWidth: false,
      wrappingWidth: 10000,
    },
  });
  mermaidInitialized = true;
}

export const mermaidRenderer: Renderer = {
  name: "Mermaid",
  render: async (src) => {
    ensureMermaidInit();
    try { if (document.fonts?.ready) await document.fonts.ready; } catch { /* ignore font readiness errors */ }
    const mermaid = window.mermaid;
    if (!mermaid?.render) throw new Error("Mermaid is not available");
    const isERDiagram = /^\s*erDiagram\b/m.test(src);
    const cleaned = sanitizeMermaidSourceLabels(src, {
      lineBreak: "<br/>",
      preserveExisting: true,
      normalizeHtmlEntities: true,
      useNamedColon: true,
      useMarkdownStrings: true,
      wrapEdgeLabels: !isERDiagram,
    });

    const result = await mermaid.render(`mermaid-pre-${++mermaidId}`, cleaned);
    let svg = result?.svg || "";
    if (!svg) throw new Error("Mermaid output missing");
    if (isERDiagram) {
      svg = injectSvgStyle(svg, ".edgeLabel text{fill:#fff;}");
    }
    const size = parseSvgSize(svg);
    return {
      mime: "image/svg+xml",
      data: svg,
      width: size.width,
      height: size.height,
      className: "diagram-img mermaid-img",
      alt: "mermaid diagram",
    };
  },
};
