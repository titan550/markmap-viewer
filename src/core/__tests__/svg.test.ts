import { describe, expect, it } from "vitest";
import { parseSvgSize, parseSvgSizeWithUnit } from "../svg";

describe("parseSvgSize", () => {
  it("reads viewBox dimensions", () => {
    const svg = '<svg viewBox="0 0 120 80"></svg>';
    expect(parseSvgSize(svg)).toEqual({ width: 120, height: 80 });
  });

  it("falls back to width/height attributes", () => {
    const svg = '<svg width="200" height="100"></svg>';
    expect(parseSvgSize(svg)).toEqual({ width: 200, height: 100 });
  });
});

describe("parseSvgSizeWithUnit", () => {
  it("handles pt units", () => {
    const svg = '<svg width="72pt" height="36pt"></svg>';
    const size = parseSvgSizeWithUnit(svg, 16);
    expect(size).toEqual({ width: 96, height: 48 });
  });
});
