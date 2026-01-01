import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../diagrams", () => ({
  preRenderDiagramFencesToImages: vi.fn(async (md: string) => ({ mdOut: md, blobUrls: ["blob:diagram"] })),
}));
vi.mock("../math", () => ({
  preRenderMathToImages: vi.fn(async (md: string) => ({ mdOut: md })),
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
import { preRenderMathToImages } from "../math";
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
  const toggleEditorBtn = document.createElement("button");
  return { overlayEl, pasteEl, setEditorValue, transformer, mm, mindmapEl, toggleEditorBtn };
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
    const { overlayEl, pasteEl, setEditorValue, transformer, mm, toggleEditorBtn } = makeDeps();
    pasteEl.value = "# Title";
    const pipeline = createRenderPipeline({
      transformer,
      mm,
      overlayEl,
      pasteEl,
      setEditorValue,
      toggleEditorBtn,
    });

    await pipeline.render("# Title");

    expect(mm.setData).toHaveBeenCalledTimes(2);
    expect(waitForDomImages).toHaveBeenCalled();
    expect(overlayEl.classList.contains("hidden")).toBe(true);
    expect(setEditorValue).toHaveBeenCalledWith("# Title");
  });

  it("skips empty input", async () => {
    const { overlayEl, pasteEl, setEditorValue, transformer, mm, toggleEditorBtn } = makeDeps();
    const pipeline = createRenderPipeline({
      transformer,
      mm,
      overlayEl,
      pasteEl,
      setEditorValue,
      toggleEditorBtn,
    });

    await pipeline.render("   ");
    expect(mm.setData).not.toHaveBeenCalled();
    expect(waitForDomImages).not.toHaveBeenCalled();
  });

  it("handles math render cancel gracefully", async () => {
    const { overlayEl, pasteEl, setEditorValue, transformer, mm, toggleEditorBtn } = makeDeps();
    const pipeline = createRenderPipeline({
      transformer,
      mm,
      overlayEl,
      pasteEl,
      setEditorValue,
      toggleEditorBtn,
    });
    const mathPre = vi.mocked(preRenderMathToImages);
    mathPre.mockResolvedValueOnce(null);

    await pipeline.render("# Title");
    expect(mm.setData).not.toHaveBeenCalled();
  });

  it("handles diagram render cancel gracefully", async () => {
    const { overlayEl, pasteEl, setEditorValue, transformer, mm, toggleEditorBtn } = makeDeps();
    const pipeline = createRenderPipeline({
      transformer,
      mm,
      overlayEl,
      pasteEl,
      setEditorValue,
      toggleEditorBtn,
    });
    const mathPre = vi.mocked(preRenderMathToImages);
    const diagramPre = vi.mocked(preRenderDiagramFencesToImages);
    mathPre.mockResolvedValueOnce({ mdOut: "# Title" });
    diagramPre.mockResolvedValueOnce(null);

    await pipeline.render("# Title");
    expect(mm.setData).not.toHaveBeenCalled();
  });

  it("normalizes fence languages before rendering", async () => {
    const { overlayEl, pasteEl, setEditorValue, transformer, mm, toggleEditorBtn } = makeDeps();
    const pipeline = createRenderPipeline({
      transformer,
      mm,
      overlayEl,
      pasteEl,
      setEditorValue,
      toggleEditorBtn,
    });

    // Mock transformer to capture what it receives
    const transformSpy = vi.spyOn(transformer, "transform");

    await pipeline.render("# Test\n```ts\ncode\n```");

    // Verify transformer received normalized language
    const transformCall = transformSpy.mock.calls[0][0];
    expect(transformCall).toContain("```typescript");
    expect(transformCall).not.toContain("```ts");
  });

  it("normalizes multiple fence languages", async () => {
    const { overlayEl, pasteEl, setEditorValue, transformer, mm, toggleEditorBtn } = makeDeps();
    const pipeline = createRenderPipeline({
      transformer,
      mm,
      overlayEl,
      pasteEl,
      setEditorValue,
      toggleEditorBtn,
    });

    const transformSpy = vi.spyOn(transformer, "transform");

    await pipeline.render("# Test\n```js\ncode\n```\n```py\ncode\n```");

    const transformCall = transformSpy.mock.calls[0][0];
    expect(transformCall).toContain("```javascript");
    expect(transformCall).toContain("```python");
    expect(transformCall).not.toContain("```js\n");
    expect(transformCall).not.toContain("```py\n");
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

  it("unwraps p tags containing text content", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.innerHTML = `
      <foreignObject>
        <div xmlns="http://www.w3.org/1999/xhtml">
          <p>Some text content</p>
        </div>
      </foreignObject>
    `;

    fixSafariForeignObjectParagraphs(svg);

    expect(svg.querySelector("foreignObject p")).toBeNull();
    expect(svg.querySelector("foreignObject div")?.textContent).toContain("Some text content");
  });

  it("unwraps p tags containing mixed content", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.innerHTML = `
      <foreignObject>
        <div xmlns="http://www.w3.org/1999/xhtml">
          <p>Text and <span class="diagram-wrap"><img src="blob:test" /></span></p>
        </div>
      </foreignObject>
    `;

    fixSafariForeignObjectParagraphs(svg);

    expect(svg.querySelector("foreignObject p")).toBeNull();
    expect(svg.querySelector("foreignObject div")?.textContent).toContain("Text and");
    expect(svg.querySelector("foreignObject .diagram-wrap")).not.toBeNull();
  });

  it("unwraps all p tags in multiple foreignObjects", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.innerHTML = `
      <foreignObject>
        <div><p><span class="diagram-wrap"><img src="blob:1" /></span></p></div>
      </foreignObject>
      <foreignObject>
        <div><p><span class="diagram-wrap"><img src="blob:2" /></span></p></div>
      </foreignObject>
      <foreignObject>
        <div><p>Some text</p></div>
      </foreignObject>
    `;

    fixSafariForeignObjectParagraphs(svg);

    expect(svg.querySelectorAll("foreignObject p").length).toBe(0);
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
