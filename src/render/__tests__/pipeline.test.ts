import { describe, expect, it, vi } from "vitest";

vi.mock("../diagrams", () => ({
  preRenderDiagramFencesToImages: vi.fn(async (md: string) => ({ mdOut: md, blobUrls: ["blob:diagram"] })),
}));
vi.mock("../math", () => ({
  preRenderMathToImages: vi.fn(async (md: string) => ({ mdOut: md, blobUrls: ["blob:math"] })),
  preRenderMathLinesToImages: vi.fn(async (md: string, urls: string[]) => ({ mdOut: md, blobUrls: urls })),
  renderInlineMarkdown: vi.fn((text: string) => text),
}));
vi.mock("../images", () => ({
  preloadImages: vi.fn(async () => {}),
}));
vi.mock("../blobs", () => ({
  revokeBlobs: vi.fn(),
}));

import { createRenderPipeline } from "../pipeline";
import { preRenderDiagramFencesToImages } from "../diagrams";
import { preRenderMathLinesToImages, preRenderMathToImages } from "../math";
import { revokeBlobs } from "../blobs";

function makeDeps() {
  const overlayEl = document.createElement("div");
  const pasteEl = document.createElement("textarea");
  const setEditorValue = vi.fn();
  const transformer = { transform: (md: string) => ({ root: { md } }) };
  const mm = { setData: vi.fn(async () => {}), fit: vi.fn() };
  return { overlayEl, pasteEl, setEditorValue, transformer, mm };
}

describe("render pipeline", () => {
  it("renders and hides overlay", async () => {
    const { overlayEl, pasteEl, setEditorValue, transformer, mm } = makeDeps();
    pasteEl.value = "# Title";
    const pipeline = createRenderPipeline({
      transformer,
      mm,
      overlayEl,
      pasteEl,
      setEditorValue,
    });

    await pipeline.render("# Title");

    expect(mm.setData).toHaveBeenCalledTimes(1);
    expect(overlayEl.classList.contains("hidden")).toBe(true);
    expect(setEditorValue).toHaveBeenCalledWith("# Title");
  });

  it("skips empty input", async () => {
    const { overlayEl, pasteEl, setEditorValue, transformer, mm } = makeDeps();
    const pipeline = createRenderPipeline({
      transformer,
      mm,
      overlayEl,
      pasteEl,
      setEditorValue,
    });

    await pipeline.render("   ");
    expect(mm.setData).not.toHaveBeenCalled();
  });

  it("revokes math blobs when math line render cancels", async () => {
    const { overlayEl, pasteEl, setEditorValue, transformer, mm } = makeDeps();
    const pipeline = createRenderPipeline({
      transformer,
      mm,
      overlayEl,
      pasteEl,
      setEditorValue,
    });
    const mathPre = vi.mocked(preRenderMathToImages);
    const mathLines = vi.mocked(preRenderMathLinesToImages);
    mathPre.mockResolvedValueOnce({ mdOut: "# Title", blobUrls: ["blob:math-a"] });
    mathLines.mockResolvedValueOnce(null);

    await pipeline.render("# Title");
    expect(revokeBlobs).toHaveBeenCalledWith(["blob:math-a"]);
  });

  it("revokes math line blobs when diagram render cancels", async () => {
    const { overlayEl, pasteEl, setEditorValue, transformer, mm } = makeDeps();
    const pipeline = createRenderPipeline({
      transformer,
      mm,
      overlayEl,
      pasteEl,
      setEditorValue,
    });
    const mathPre = vi.mocked(preRenderMathToImages);
    const mathLines = vi.mocked(preRenderMathLinesToImages);
    const diagramPre = vi.mocked(preRenderDiagramFencesToImages);
    mathPre.mockResolvedValueOnce({ mdOut: "# Title", blobUrls: ["blob:math-a"] });
    mathLines.mockResolvedValueOnce({ mdOut: "# Title", blobUrls: ["blob:math-b"] });
    diagramPre.mockResolvedValueOnce(null);

    await pipeline.render("# Title");
    expect(revokeBlobs).toHaveBeenCalledWith(["blob:math-b"]);
  });
});
