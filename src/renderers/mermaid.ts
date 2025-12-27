import { sanitizeMermaidSourceLabels } from "../core/mermaidSanitize";
import { injectSvgStyle, parseSvgSize } from "../core/svg";
import type { Renderer } from "./types";

let mermaidInitialized = false;
let mermaidId = 0;

function ensureMermaidInit() {
  if (mermaidInitialized) return;
  window.mermaid.initialize({
    startOnLoad: false,
    htmlLabels: false,
    markdownAutoWrap: true,
    wrap: true,
    flowchart: {
      htmlLabels: false,
      useMaxWidth: false,
      wrappingWidth: 340,
    },
  });
  mermaidInitialized = true;
}

export const mermaidRenderer: Renderer = {
  name: "Mermaid",
  render: async (src) => {
    ensureMermaidInit();
    try { if (document.fonts?.ready) await document.fonts.ready; } catch { /* ignore font readiness errors */ }
    const isERDiagram = /^\s*erDiagram\b/m.test(src);
    const cleaned = sanitizeMermaidSourceLabels(src, {
      lineBreak: "\n",
      preserveExisting: true,
      normalizeHtmlEntities: true,
      useNamedColon: true,
      useMarkdownStrings: true,
      wrapEdgeLabels: !isERDiagram,
    });

    const result = await window.mermaid.render(`mermaid-pre-${++mermaidId}`, cleaned);
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
