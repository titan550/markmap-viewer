import { describe, expect, it } from "vitest";
import { shouldRenderInlineMath } from "../math";

describe("shouldRenderInlineMath", () => {
  it("skips currency-like ranges", () => {
    expect(shouldRenderInlineMath("100 to 200")).toBe(false);
    expect(shouldRenderInlineMath("100-200")).toBe(false);
  });

  it("renders when LaTeX tokens are present", () => {
    expect(shouldRenderInlineMath("x^2")).toBe(true);
    expect(shouldRenderInlineMath("O(n \\log n)")).toBe(true);
    expect(shouldRenderInlineMath("\\alpha + \\beta")).toBe(true);
  });

  it("skips empty strings", () => {
    expect(shouldRenderInlineMath(" ")).toBe(false);
  });
});
