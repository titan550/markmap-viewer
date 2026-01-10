import { describe, expect, it, vi } from "vitest";
import { getRasterScale, preloadImages, svgToPngBlob } from "../images";

describe("getRasterScale", () => {
  it("clamps device pixel ratio", () => {
    const original = window.devicePixelRatio;
    Object.defineProperty(window, "devicePixelRatio", { value: 3, configurable: true });
    expect(getRasterScale()).toBe(2);
    Object.defineProperty(window, "devicePixelRatio", { value: original, configurable: true });
  });
});

describe("preloadImages", () => {
  it("loads image urls sequentially", async () => {
    const originalImage = window.Image;
    const calls: string[] = [];
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) {
        calls.push(value);
        setTimeout(() => this.onload && this.onload(), 0);
      }
    }
    // @ts-expect-error test mock
    window.Image = MockImage;
    await preloadImages(["blob:one", "blob:two"], () => true);
    expect(calls).toEqual(["blob:one", "blob:two"]);
    window.Image = originalImage;
  });
});

describe("svgToPngBlob", () => {
  it("rasterizes svg into a png blob", async () => {
    const originalCreate = document.createElement.bind(document);
    const originalImage = window.Image;
    const ctx = {
      drawImage: vi.fn(),
    };
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: () => ctx,
      toBlob: (cb: (blob: Blob | null) => void) => cb(new Blob(["png"], { type: "image/png" })),
    } as unknown as HTMLCanvasElement;

    document.createElement = ((tag: string) => {
      if (tag === "canvas") return mockCanvas;
      return originalCreate(tag);
    }) as typeof document.createElement;

    class MockImage {
      decoding = "async";
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      decode() {
        return Promise.resolve();
      }
      set src(_value: string) {
        setTimeout(() => this.onload && this.onload(), 0);
      }
    }
    // @ts-expect-error test mock
    window.Image = MockImage;

    const blob = await svgToPngBlob('<svg width="10" height="10"></svg>', 10, 10, 1);
    expect(blob.type).toBe("image/png");

    document.createElement = originalCreate;
    window.Image = originalImage;
  });

  it("handles images without decode()", async () => {
    const originalCreate = document.createElement.bind(document);
    const originalImage = window.Image;
    const ctx = { drawImage: vi.fn() };
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: () => ctx,
      toBlob: (cb: (blob: Blob | null) => void) => cb(new Blob(["png"], { type: "image/png" })),
    } as unknown as HTMLCanvasElement;

    document.createElement = ((tag: string) => {
      if (tag === "canvas") return mockCanvas;
      return originalCreate(tag);
    }) as typeof document.createElement;

    class MockImage {
      decoding = "async";
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        setTimeout(() => this.onload && this.onload(), 0);
      }
    }
    // @ts-expect-error test mock
    window.Image = MockImage;

    const blob = await svgToPngBlob('<svg width="10" height="10"></svg>', 10, 10, 1);
    expect(blob.type).toBe("image/png");

    document.createElement = originalCreate;
    window.Image = originalImage;
  });
});
