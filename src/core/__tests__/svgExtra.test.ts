import { describe, expect, it } from "vitest";
import { injectSvgStyle, parseSvgSize, parseSvgSizeWithUnit, setSvgPixelSize } from "../svg";

describe("svg helpers", () => {
  it("injects style tag when missing", () => {
    const svg = "<svg></svg>";
    const out = injectSvgStyle(svg, "rect{fill:red;}");
    expect(out).toContain("<style>");
    expect(out).toContain("rect{fill:red;}");
  });

  it("appends style to existing style tag", () => {
    const svg = "<svg><style>.a{}</style></svg>";
    const out = injectSvgStyle(svg, ".b{}");
    expect(out).toContain(".a{}" );
    expect(out).toContain(".b{}" );
  });

  it("sets pixel size on svg", () => {
    const svg = "<svg width=\"10\" height=\"10\"></svg>";
    const out = setSvgPixelSize(svg, 120, 80);
    expect(out).toContain("width=\"120\"");
    expect(out).toContain("height=\"80\"");
    expect(out).toContain("style=\"width:120px;height:80px;\"");
  });

  it("falls back to width/height when no viewBox", () => {
    const svg = "<svg width=\"200\" height=\"90\"></svg>";
    expect(parseSvgSize(svg)).toEqual({ width: 200, height: 90 });
  });

  it("falls back to default size when no dimensions", () => {
    const svg = "<svg></svg>";
    expect(parseSvgSize(svg)).toEqual({ width: 480, height: 240 });
  });

  it("parses size units for svg width/height", () => {
    const svg = "<svg width=\"2cm\" height=\"10mm\"></svg>";
    const size = parseSvgSizeWithUnit(svg, 16);
    expect(size?.width).toBeGreaterThan(70);
    expect(size?.height).toBeGreaterThan(30);
  });
});
