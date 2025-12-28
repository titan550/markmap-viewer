import { describe, expect, it, vi } from "vitest";

vi.mock("../../renderers/mermaid", () => ({
  mermaidRenderer: {
    name: "Mermaid",
    render: vi.fn(async () => ({
      mime: "image/svg+xml",
      data: "<svg viewBox='0 0 10 10'></svg>",
      width: 10,
      height: 10,
      className: "diagram-img mermaid-img",
      alt: "mermaid diagram",
    })),
  },
}));
vi.mock("../../renderers/dot", () => ({
  dotRenderer: {
    name: "DOT",
    render: vi.fn(async () => ({
      mime: "image/svg+xml",
      data: "<svg viewBox='0 0 10 10'></svg>",
      width: 10,
      height: 10,
      className: "diagram-img dot-img",
      alt: "dot diagram",
    })),
  },
}));
vi.mock("../../renderers/wavedrom", () => ({
  wavedromRenderer: {
    name: "WaveDrom",
    render: vi.fn(async () => ({
      mime: "image/svg+xml",
      data: "<svg viewBox='0 0 10 10'></svg>",
      width: 10,
      height: 10,
      className: "diagram-img wavedrom-img",
      alt: "wavedrom diagram",
    })),
  },
}));
vi.mock("../../renderers/vegaLite", () => ({
  vegaLiteRenderer: {
    name: "Vega-Lite",
    render: vi.fn(async () => ({
      mime: "image/svg+xml",
      data: "<svg viewBox='0 0 10 10'></svg>",
      width: 10,
      height: 10,
      className: "diagram-img vega-img",
      alt: "vega-lite chart",
    })),
  },
}));

import { preRenderDiagramFencesToImages } from "../diagrams";
import { mermaidRenderer } from "../../renderers/mermaid";

describe("preRenderDiagramFencesToImages", () => {
  it("replaces mermaid fences with images", async () => {
    const md = "```mermaid\nflowchart LR\nA-->B\n```";
    const res = await preRenderDiagramFencesToImages(md, 1, () => true);
    expect(res?.mdOut).toContain("diagram-wrap");
    expect(res?.mdOut).toContain("<img");
    expect(res?.blobUrls.length).toBe(1);
  });

  it("keeps unknown fences intact", async () => {
    const md = "```unknown\nhello\n```";
    const res = await preRenderDiagramFencesToImages(md, 1, () => true);
    expect(res?.mdOut).toContain(md);
  });

  it("appends image to list items when nested", async () => {
    const md = "- Parent\n  ```dot\nA->B\n  ```";
    const res = await preRenderDiagramFencesToImages(md, 1, () => true);
    expect(res?.mdOut).toContain("- Parent\n  <span");
  });

  it("appends inline when list item already exists", async () => {
    const md = "- Parent\n  - Child\n  ```mermaid\nflowchart LR\nA-->B\n  ```";
    const res = await preRenderDiagramFencesToImages(md, 1, () => true);
    expect(res?.mdOut).toContain("- Child <span");
  });

  it("keeps fence when renderer throws", async () => {
    // @ts-expect-error test mock
    mermaidRenderer.render.mockImplementationOnce(() => { throw new Error("boom"); });
    const md = "```mermaid\nflowchart LR\nA-->B\n```";
    const res = await preRenderDiagramFencesToImages(md, 1, () => true);
    expect(res?.mdOut).toContain(md);
  });

  it("returns null when renderer returns null", async () => {
    // @ts-expect-error test mock
    mermaidRenderer.render.mockImplementationOnce(() => null);
    const md = "```mermaid\nflowchart LR\nA-->B\n```";
    const res = await preRenderDiagramFencesToImages(md, 1, () => true);
    expect(res).toBeNull();
  });

  it("keeps fence when renderer returns empty output", async () => {
    // @ts-expect-error test mock
    mermaidRenderer.render.mockImplementationOnce(() => ({ mime: "", data: "" }));
    const md = "```mermaid\nflowchart LR\nA-->B\n```";
    const res = await preRenderDiagramFencesToImages(md, 1, () => true);
    expect(res?.mdOut).toContain(md);
  });

  it("returns null when cancelled", async () => {
    const md = "```mermaid\nflowchart LR\nA-->B\n```";
    const res = await preRenderDiagramFencesToImages(md, 1, () => false);
    expect(res).toBeNull();
  });
});
