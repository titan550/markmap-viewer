import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const fixturesDir = path.join(process.cwd(), "test");
const fixtureFiles = fs.readdirSync(fixturesDir).filter((file) => file.endsWith(".md"));

const diagramLanguages = [
  "mermaid",
  "dot",
  "graphviz",
  "gv",
  "wavedrom",
  "wave",
  "wavejson",
  "vega-lite",
  "vl",
];

function countFence(text: string, lang: string) {
  const re = new RegExp(`^\\s*\\\`\\\`\\\`${lang}\\b`, "gmi");
  return (text.match(re) || []).length;
}

async function loadMarkdown(page, text: string) {
  await page.goto("/");
  await page.waitForSelector("#paste", { state: "attached" });
  await page.evaluate((md) => {
    const paste = document.querySelector("#paste");
    if (!paste) return;
    paste.value = md;
    paste.dispatchEvent(new Event("input", { bubbles: true }));
  }, text);
  await page.waitForTimeout(2500);
}

test.describe("Safari foreignObject positioning", () => {
  test("consecutive mermaid diagrams render at different positions", async ({ page }) => {
    const markdown = `## Test Section

\`\`\`mermaid
flowchart LR
  A[First] --> B[Second]
\`\`\`

\`\`\`mermaid
flowchart LR
  C[Third] --> D[Fourth]
\`\`\`
`;

    await loadMarkdown(page, markdown);

    await page.waitForFunction(() => document.querySelectorAll("img.mermaid-img").length >= 2, {
      timeout: 30000,
    });

    // Wait for <p> unwrapping to complete (fixSafariForeignObjectParagraphs runs after render)
    await page.waitForFunction(
      () => document.querySelectorAll("foreignObject p .diagram-wrap").length === 0,
      { timeout: 5000 }
    );

    // Diagrams should not be wrapped in <p> tags (causes Safari rendering bug)
    const pWrappedDiagrams = await page.evaluate(
      () => document.querySelectorAll("foreignObject p .diagram-wrap").length
    );
    expect(pWrappedDiagrams).toBe(0);

    // Diagrams should be at different Y positions, not clustered at top
    const positions = await page.evaluate(() =>
      Array.from(document.querySelectorAll("foreignObject img.mermaid-img")).map((img) => {
        const rect = img.getBoundingClientRect();
        return { x: rect.x, y: rect.y };
      })
    );

    expect(positions.length).toBe(2);
    const yDiff = Math.abs(positions[0].y - positions[1].y);
    expect(yDiff).toBeGreaterThan(50);
  });
});

test.describe("fixture markdown render", () => {
  test.setTimeout(90000);
  for (const file of fixtureFiles) {
    test(`${file} renders diagrams`, async ({ page }) => {
      const filePath = path.join(fixturesDir, file);
      const text = fs.readFileSync(filePath, "utf8");

      const expectedMermaid = countFence(text, "mermaid");
      const expectedDiagrams = diagramLanguages.reduce(
        (sum, lang) => sum + countFence(text, lang),
        0
      );

      await loadMarkdown(page, text);

      if (expectedDiagrams > 0) {
        await page.waitForFunction(
          ({ minDiagram, minMermaid }) => {
            const diagramImgs = document.querySelectorAll("img.diagram-img").length;
            const mermaidImgs = document.querySelectorAll("img.mermaid-img").length;
            return diagramImgs >= minDiagram && mermaidImgs >= minMermaid;
          },
          { minDiagram: expectedDiagrams, minMermaid: expectedMermaid },
          { timeout: 60000 }
        );
      }

      const counts = await page.evaluate(() => ({
        diagramImgs: document.querySelectorAll("img.diagram-img").length,
        mermaidImgs: document.querySelectorAll("img.mermaid-img").length,
      }));

      expect(counts.diagramImgs).toBeGreaterThanOrEqual(expectedDiagrams);
      expect(counts.mermaidImgs).toBeGreaterThanOrEqual(expectedMermaid);

      if (counts.diagramImgs > 1) {
        const positions = await page.evaluate(() =>
          Array.from(document.querySelectorAll("foreignObject img.diagram-img")).map((img) => {
            const rect = img.getBoundingClientRect();
            return { x: rect.x, y: rect.y };
          })
        );
        const ys = positions.map((pos) => pos.y);
        const spread = Math.max(...ys) - Math.min(...ys);
        expect(spread).toBeGreaterThan(20);
      }
    });
  }
});
