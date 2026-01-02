import { test, expect } from "@playwright/test";

const htmlSource = `
<pre><code class="language-mermaid">classDiagram
  class&nbsp;Transformer {
    +transform(md)&nbsp;Root
    +md&nbsp;MarkdownIt
  }
  class&nbsp;Markmap {
    +setData(root)
    +renderData(root)
    +fit()
    +findElement(node)
  }
  class&nbsp;Mermaid {
    +initialize(opts)
    +run(nodes)
  }
  Transformer --&gt; Markmap : produces&nbsp;root
  Markmap --&gt; Mermaid : exposes&nbsp;foreignObject nodes
  Mermaid --&gt; Markmap : forces&nbsp;relayout
</code></pre>`;

async function pasteHtml(page, html: string, plain: string) {
  await page.goto("/");
  await page.waitForSelector("#paste", { state: "attached" });
  await page.evaluate(({ htmlText, plainText }) => {
    const paste = document.querySelector("#paste");
    if (!paste) return;
    const dt = new DataTransfer();
    dt.setData("text/html", htmlText);
    dt.setData("text/plain", plainText);
    const ev = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "clipboardData", { value: dt });
    paste.dispatchEvent(ev);
  }, { htmlText: html, plainText: plain });
  await page.waitForTimeout(2500);
}

test.describe("mermaid nbsp handling", () => {
  test("renders class diagram without nbsp entities in svg", async ({ page }) => {
    await pasteHtml(page, htmlSource, "");
    await page.waitForFunction(
      () => document.querySelectorAll("foreignObject img.diagram-img").length >= 1,
      { timeout: 30000 }
    );

    const svgText = await page.evaluate(async () => {
      const img = document.querySelector("foreignObject img.diagram-img") as HTMLImageElement | null;
      if (!img?.src) return "";
      const res = await fetch(img.src);
      return await res.text();
    });

    expect(svgText).toContain("<svg");
    expect(svgText).not.toContain("&nbsp");
    expect(svgText).not.toContain("&amp;nbsp");
    expect(svgText).not.toContain("&amp;nbs");
    expect(svgText).not.toContain("&amp;nb");
    expect(svgText).not.toContain("\u00a0");
  });
});
