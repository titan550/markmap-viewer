import { describe, expect, it, vi } from "vitest";

vi.mock("../images", () => ({
  getRasterScale: () => 1,
}));

import { preRenderMathToImages } from "../math";

function mockMathJax() {
  (window as any).MathJax = {
    startup: { promise: Promise.resolve() },
    tex2svg: (_expr: string, _opts: { display: boolean }) => {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 100 50");
      const root = document.createElement("div");
      root.appendChild(svg);
      return root;
    },
  };
}

describe("preRenderMathToImages", () => {
  it("returns unchanged when MathJax is missing", async () => {
    const original = (window as any).MathJax;
    delete (window as any).MathJax;
    const res = await preRenderMathToImages("Inline $x$", () => true);
    expect(res?.mdOut).toBe("Inline $x$");
    (window as any).MathJax = original;
  });

  it("renders inline and block math", async () => {
    mockMathJax();
    (document as any).fonts = { ready: Promise.resolve() };
    const md = "Inline $x^2$\n\n$$\\int_0^1 x dx$$";
    const res = await preRenderMathToImages(md, () => true);
    expect(res?.mdOut).toContain("math-img");
    expect(res?.mdOut).toContain("data:image/svg+xml");
    expect(res?.mdOut).not.toContain("blob:");
  });

  it("skips inline currency-like values", async () => {
    mockMathJax();
    const md = "Price is $100 to 200$";
    const res = await preRenderMathToImages(md, () => true);
    expect(res?.mdOut).toContain("$100 to 200$");
  });

  it("ignores inline code spans containing dollar signs", async () => {
    mockMathJax();
    const md = "Inline code: `cost $100` and math $x^2$";
    const res = await preRenderMathToImages(md, () => true);
    expect(res?.mdOut).toContain("`cost $100`");
    expect(res?.mdOut).toContain("math-img");
  });

  it("does not render math inside tilde fences", async () => {
    mockMathJax();
    const md = "~~~\n$x$\n~~~";
    const res = await preRenderMathToImages(md, () => true);
    expect(res?.mdOut).toContain("$x$");
    expect(res?.mdOut).not.toContain("math-img");
  });

  it("does not render math inside longer backtick fences", async () => {
    mockMathJax();
    const md = "````\n$x$\n````";
    const res = await preRenderMathToImages(md, () => true);
    expect(res?.mdOut).toContain("$x$");
    expect(res?.mdOut).not.toContain("math-img");
  });
});
