import { describe, expect, it } from "vitest";
import { parseSvgSize, parseSvgSizeWithUnit, svgToDataUrl } from "../svg";

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

describe("svgToDataUrl", () => {
  it("converts SVG to data URL", () => {
    const svg = '<svg width="100" height="50"><rect x="0" y="0" width="100" height="50"/></svg>';
    const dataUrl = svgToDataUrl(svg);
    expect(dataUrl).toMatch(/^data:image\/svg\+xml,/);
    expect(decodeURIComponent(dataUrl)).toContain(svg);
  });

  it("removes XML declaration", () => {
    const svg = '<?xml version="1.0"?><svg width="10" height="10"></svg>';
    const dataUrl = svgToDataUrl(svg);
    const decoded = decodeURIComponent(dataUrl.replace("data:image/svg+xml,", ""));
    expect(decoded).not.toContain("<?xml");
    expect(decoded).toContain("<svg");
  });

  it("escapes quotes safely", () => {
    const svg = '<svg width="100"><text>It\'s "quoted"</text></svg>';
    const dataUrl = svgToDataUrl(svg);
    expect(dataUrl).toContain("%22");
    expect(dataUrl).toContain("%27");
  });

  it("handles empty SVG", () => {
    const svg = "<svg></svg>";
    const dataUrl = svgToDataUrl(svg);
    expect(dataUrl).toBe("data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E");
  });

  it("preserves SVG attributes", () => {
    const svg = '<svg width="200" height="100" viewBox="0 0 200 100"></svg>';
    const dataUrl = svgToDataUrl(svg);
    const decoded = decodeURIComponent(dataUrl.replace("data:image/svg+xml,", ""));
    expect(decoded).toContain('width="200"');
    expect(decoded).toContain('height="100"');
    expect(decoded).toContain('viewBox="0 0 200 100"');
  });
});
