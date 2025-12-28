import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  waitForDomImages: vi.fn(async () => {}),
}));
vi.mock("../blobs", () => ({
  revokeBlobs: vi.fn(),
}));

import { createRenderPipeline, fixSafariForeignObjectParagraphs } from "../pipeline";
import { preRenderDiagramFencesToImages } from "../diagrams";
import { preRenderMathLinesToImages, preRenderMathToImages } from "../math";
import { revokeBlobs } from "../blobs";
import { waitForDomImages } from "../images";

function makeDeps() {
  const overlayEl = document.createElement("div");
  const pasteEl = document.createElement("textarea");
  const setEditorValue = vi.fn();
  const transformer = { transform: (md: string) => ({ root: { md } }) };
  const mm = { setData: vi.fn(async () => {}), fit: vi.fn() };
  const mindmapEl = document.createElement("svg");
  mindmapEl.id = "mindmap";
  document.body.appendChild(mindmapEl);
  return { overlayEl, pasteEl, setEditorValue, transformer, mm, mindmapEl };
}

describe("render pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    const mindmapEl = document.getElementById("mindmap");
    if (mindmapEl) mindmapEl.remove();
  });

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

    expect(mm.setData).toHaveBeenCalledTimes(2);
    expect(waitForDomImages).toHaveBeenCalled();
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
    expect(waitForDomImages).not.toHaveBeenCalled();
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

describe("fixSafariForeignObjectParagraphs", () => {
  it("unwraps p tags containing only diagram-wrap span", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.innerHTML = `
      <foreignObject>
        <div xmlns="http://www.w3.org/1999/xhtml">
          <p data-lines="2,3"><span class="diagram-wrap"><img src="blob:test" /></span></p>
        </div>
      </foreignObject>
    `;

    fixSafariForeignObjectParagraphs(svg);

    expect(svg.querySelector("foreignObject p")).toBeNull();
    expect(svg.querySelector("foreignObject .diagram-wrap")).not.toBeNull();
    expect(svg.querySelector("foreignObject img")).not.toBeNull();
  });

  it("unwraps p tags containing nested diagram-wrap", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.innerHTML = `
      <foreignObject>
        <div xmlns="http://www.w3.org/1999/xhtml">
          <p><div><span class="diagram-wrap"><img src="blob:test" /></span></div></p>
        </div>
      </foreignObject>
    `;

    fixSafariForeignObjectParagraphs(svg);

    expect(svg.querySelector("foreignObject p")).toBeNull();
    expect(svg.querySelector("foreignObject .diagram-wrap")).not.toBeNull();
  });

  it("preserves p tags containing text content", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.innerHTML = `
      <foreignObject>
        <div xmlns="http://www.w3.org/1999/xhtml">
          <p>Some text content</p>
        </div>
      </foreignObject>
    `;

    fixSafariForeignObjectParagraphs(svg);

    expect(svg.querySelector("foreignObject p")).not.toBeNull();
    expect(svg.querySelector("foreignObject p")?.textContent).toBe("Some text content");
  });

  it("preserves p tags containing mixed content", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.innerHTML = `
      <foreignObject>
        <div xmlns="http://www.w3.org/1999/xhtml">
          <p>Text and <span class="diagram-wrap"><img src="blob:test" /></span></p>
        </div>
      </foreignObject>
    `;

    fixSafariForeignObjectParagraphs(svg);

    expect(svg.querySelector("foreignObject p")).not.toBeNull();
  });

  it("handles multiple foreignObjects", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.innerHTML = `
      <foreignObject>
        <div><p><span class="diagram-wrap"><img src="blob:1" /></span></p></div>
      </foreignObject>
      <foreignObject>
        <div><p><span class="diagram-wrap"><img src="blob:2" /></span></p></div>
      </foreignObject>
      <foreignObject>
        <div><p>Keep this text</p></div>
      </foreignObject>
    `;

    fixSafariForeignObjectParagraphs(svg);

    const paragraphs = svg.querySelectorAll("foreignObject p");
    expect(paragraphs.length).toBe(1);
    expect(paragraphs[0].textContent).toBe("Keep this text");
    expect(svg.querySelectorAll("foreignObject .diagram-wrap").length).toBe(2);
  });

  it("handles empty svg gracefully", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    expect(() => fixSafariForeignObjectParagraphs(svg)).not.toThrow();
  });

  it("handles p with only whitespace text nodes around diagram-wrap", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.innerHTML = `
      <foreignObject>
        <div xmlns="http://www.w3.org/1999/xhtml">
          <p>
            <span class="diagram-wrap"><img src="blob:test" /></span>
          </p>
        </div>
      </foreignObject>
    `;

    fixSafariForeignObjectParagraphs(svg);

    expect(svg.querySelector("foreignObject p")).toBeNull();
    expect(svg.querySelector("foreignObject .diagram-wrap")).not.toBeNull();
  });
});
