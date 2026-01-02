import { describe, expect, it } from "vitest";
import { sanitizeSvgForXml } from "../svgSanitize";

describe("sanitizeSvgForXml", () => {
  it("normalizes nbsp entities", () => {
    const svg = "<svg><text>&nbsp;</text></svg>";
    const out = sanitizeSvgForXml(svg);
    expect(out).not.toContain("&nbsp");
  });

  it("normalizes unterminated nbsp entities", () => {
    const svg = "<svg><text>&nbsp</text></svg>";
    const out = sanitizeSvgForXml(svg);
    expect(out).not.toContain("&nbsp");
  });

  it("escapes unknown named entities", () => {
    const svg = "<svg><text>&foo;</text></svg>";
    expect(sanitizeSvgForXml(svg)).toContain("&amp;foo;");
  });

  it("preserves xml-safe entities", () => {
    const svg = "<svg><text>&amp;</text></svg>";
    expect(sanitizeSvgForXml(svg)).toContain("&amp;");
  });

  it("normalizes escaped nbsp entities", () => {
    const svg = "<svg><text>&amp;nbsp;</text></svg>";
    const out = sanitizeSvgForXml(svg);
    expect(out).not.toContain("&amp;nbsp");
    expect(out).not.toContain("&nbsp");
  });

  it("normalizes split escaped nbsp entities", () => {
    const svg = "<svg><text><tspan>&amp;nbs</tspan><tspan>p;Root</tspan></text></svg>";
    const out = sanitizeSvgForXml(svg);
    expect(out).toContain("</tspan><tspan>Root");
    expect(out).toContain("> </tspan>");
    expect(out).not.toContain("&amp;nbs");
    expect(out).not.toContain("&nbsp");
  });

  it("normalizes shorter split escaped nbsp entities", () => {
    const svg = "<svg><text><tspan>&amp;nb</tspan><tspan>sp;Root</tspan></text></svg>";
    const out = sanitizeSvgForXml(svg);
    expect(out).toContain("</tspan><tspan>Root");
    expect(out).toContain("> </tspan>");
    expect(out).not.toContain("&amp;nb");
    expect(out).not.toContain("&nbsp");
  });
});
