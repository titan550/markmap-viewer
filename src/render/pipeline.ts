import { markmapNormalize } from "../core/markmapNormalize";
import { revokeBlobs } from "./blobs";
import { preRenderDiagramFencesToImages } from "./diagrams";
import { nextFrames } from "./frames";
import { preloadImages } from "./images";
import { preRenderMathLinesToImages, preRenderMathToImages, renderInlineMarkdown } from "./math";
import type { MarkmapInstance, MarkmapTransformer } from "../types/markmap";

export type RenderPipelineDeps = {
  transformer: MarkmapTransformer;
  mm: MarkmapInstance;
  overlayEl: HTMLElement;
  pasteEl: HTMLTextAreaElement;
  setEditorValue: (value: string) => void;
};

export type RenderPipeline = {
  render: (mdText: string) => Promise<void>;
};

export function createRenderPipeline(deps: RenderPipelineDeps): RenderPipeline {
  const { transformer, mm, overlayEl, pasteEl, setEditorValue } = deps;
  let renderedOnce = false;
  let pending = 0;
  let activeBlobUrls: string[] = [];

  const hideOverlayOnce = () => {
    if (!renderedOnce) {
      overlayEl.classList.add("hidden");
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
      const mathPre = await preRenderMathToImages(normalized, shouldContinue);
      if (!mathPre || !shouldContinue()) return;
      const inlineRenderer = (line: string) => renderInlineMarkdown(line, transformer);
      const mathLinePre = await preRenderMathLinesToImages(mathPre.mdOut, mathPre.blobUrls, shouldContinue, inlineRenderer);
      if (!mathLinePre || !shouldContinue()) {
        revokeBlobs(mathPre.blobUrls);
        return;
      }
      const diagramPre = await preRenderDiagramFencesToImages(mathLinePre.mdOut, token, shouldContinue);
      if (!diagramPre || !shouldContinue()) {
        revokeBlobs(mathLinePre.blobUrls);
        return;
      }
      revokeBlobs(activeBlobUrls);
      activeBlobUrls = [...mathLinePre.blobUrls, ...diagramPre.blobUrls];

      const { root } = transformer.transform(diagramPre.mdOut);
      await preloadImages(activeBlobUrls, shouldContinue);
      if (!shouldContinue()) return;
      await mm.setData(root);

      await nextFrames(2);
      if (!shouldContinue()) return;

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
