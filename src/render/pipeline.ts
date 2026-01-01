import { markmapNormalize } from "../core/markmapNormalize";
import { normalizeFenceLang } from "../core/normalizeFenceLang";
import { revokeBlobs } from "./blobs";
import { preRenderDiagramFencesToImages } from "./diagrams";
import { nextFrames } from "./frames";
import { preloadImages, waitForDomImages } from "./images";
import { preRenderMathToImages } from "./math";
import type { MarkmapInstance, MarkmapTransformer } from "../types/markmap";

/**
 * Unwrap all <p> tags to fix Safari foreignObject rendering.
 * Safari renders <p> elements inside foreignObject at the SVG root (0,0).
 */
export function fixSafariForeignObjectParagraphs(svg: Element): void {
  const paragraphs = svg.querySelectorAll("foreignObject p");
  paragraphs.forEach((p) => {
    const parent = p.parentNode;
    if (parent) {
      while (p.firstChild) {
        parent.insertBefore(p.firstChild, p);
      }
      parent.removeChild(p);
    }
  });
}

export type RenderPipelineDeps = {
  transformer: MarkmapTransformer;
  mm: MarkmapInstance;
  overlayEl: HTMLElement;
  pasteEl: HTMLTextAreaElement;
  setEditorValue: (value: string) => void;
  toggleEditorBtn: HTMLButtonElement;
};

export type RenderPipeline = {
  render: (mdText: string) => Promise<void>;
};

export function createRenderPipeline(deps: RenderPipelineDeps): RenderPipeline {
  const { transformer, mm, overlayEl, pasteEl, setEditorValue, toggleEditorBtn } = deps;
  let renderedOnce = false;
  let pending = 0;
  let activeBlobUrls: string[] = [];

  const hideOverlayOnce = () => {
    if (!renderedOnce) {
      overlayEl.classList.add("hidden");
      toggleEditorBtn.style.display = "block";
      renderedOnce = true;

      if (pasteEl.value) {
        setEditorValue(pasteEl.value);
      }
    }
  };

  const render = async (mdText: string) => {
    const text = (mdText || "").trim();
    if (!text) return;

    const token = ++pending;
    const shouldContinue = () => token === pending;

    try {
      const normalized = markmapNormalize(text);
      const langNormalized = normalizeFenceLang(normalized);
      const mathPre = await preRenderMathToImages(langNormalized, shouldContinue);
      if (!mathPre || !shouldContinue()) return;
      const diagramPre = await preRenderDiagramFencesToImages(mathPre.mdOut, token, shouldContinue);
      if (!diagramPre || !shouldContinue()) return;
      revokeBlobs(activeBlobUrls);
      activeBlobUrls = diagramPre.blobUrls;
      const hasImages = activeBlobUrls.length > 0;

      const { root } = transformer.transform(diagramPre.mdOut);
      await preloadImages(activeBlobUrls, shouldContinue);
      if (!shouldContinue()) return;
      await mm.setData(root);
      await nextFrames(2);
      if (!shouldContinue()) return;

      const svg = document.querySelector("#mindmap");
      if (svg) {
        fixSafariForeignObjectParagraphs(svg);
        // Highlight code blocks with Prism
        if (window.Prism) {
          window.Prism.highlightAllUnder(svg);
        }
      }

      if (hasImages && svg) {
        await waitForDomImages(svg, shouldContinue);
        if (!shouldContinue()) return;
        await mm.setData(root);
        await nextFrames(1);
        if (!shouldContinue()) return;
        fixSafariForeignObjectParagraphs(svg);
        // Highlight code blocks with Prism
        if (window.Prism) {
          window.Prism.highlightAllUnder(svg);
        }
      }

      mm.fit();
      hideOverlayOnce();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("Render failed:", e);
      alert("Render error: " + message);
    }
  };

  return { render };
}
