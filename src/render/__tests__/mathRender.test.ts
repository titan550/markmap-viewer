import { describe, expect, it, vi } from "vitest";
import { preRenderMathLinesToImages, renderInlineMarkdown, renderHtmlLineToPng } from "../math";

function mockCanvas() {
  const originalCreate = document.createElement.bind(document);
  const originalImage = window.Image;
  const ctx = {
    measureText: (text: string) => ({
      width: text.length * 6,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
    }),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    scale: vi.fn(),
  };
  const mockCanvasEl = {
    width: 0,
    height: 0,
    getContext: () => ctx,
    toBlob: (cb: (blob: Blob | null) => void) => cb(new Blob(["png"], { type: "image/png" })),
  } as unknown as HTMLCanvasElement;

  document.createElement = ((tag: string) => {
    if (tag === "canvas") return mockCanvasEl;
    return originalCreate(tag);
  }) as typeof document.createElement;

  return () => {
    document.createElement = originalCreate;
    window.Image = originalImage;
  };
}

describe("renderInlineMarkdown", () => {
  it("escapes text but keeps images", () => {
    const html = renderInlineMarkdown("<img src=\"x\"> &", {
      md: { renderInline: undefined },
    });
    expect(html).toContain("<img");
    expect(html).toContain("&amp;");
  });
});

describe("renderHtmlLineToPng", () => {
  it("returns a png blob", async () => {
    const restore = mockCanvas();
    const originalImage = window.Image;
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        setTimeout(() => this.onload && this.onload(), 0);
      }
    }
    // @ts-expect-error test mock
    window.Image = MockImage;
    const result = await renderHtmlLineToPng("hello");
    expect(result.blob.type).toBe("image/png");
    restore();
    window.Image = originalImage;
  });
});

describe("preRenderMathLinesToImages", () => {
  it("replaces list inline math lines with images", async () => {
    const restore = mockCanvas();
    const originalImage = window.Image;
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        setTimeout(() => this.onload && this.onload(), 0);
      }
    }
    // @ts-expect-error test mock
    window.Image = MockImage;
    const md = "- Inline math: <img class=\"math-img\" src=\"blob:math\" width=\"10\" height=\"10\">";
    const res = await preRenderMathLinesToImages(md, [], () => true, (text) => text);
    expect(res?.mdOut).toContain("math-line-img");
    restore();
    window.Image = originalImage;
  });

  it("returns original when no inline math images exist", async () => {
    const md = "- Item without math";
    const res = await preRenderMathLinesToImages(md, [], () => true, (text) => text);
    expect(res?.mdOut).toBe(md);
  });

  it("keeps text when inline renderer throws", async () => {
    const md = "- Inline math: <img class=\"math-img\" src=\"blob:math\" width=\"10\" height=\"10\">";
    const res = await preRenderMathLinesToImages(md, [], () => true, () => {
      throw new Error("boom");
    });
    expect(res?.mdOut).toContain(md);
  });
});
