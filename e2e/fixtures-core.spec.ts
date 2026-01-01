import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const fixturePath = path.join(process.cwd(), "test", "fixtures_core.md");
const fixtureText = fs.readFileSync(fixturePath, "utf8");

async function loadFixture(page) {
  await page.goto("/");
  await page.waitForSelector("#paste", { state: "attached" });
  await page.evaluate((text) => {
    const paste = document.querySelector("#paste");
    if (!paste) return;
    paste.value = text;
    paste.dispatchEvent(new Event("input", { bubbles: true }));
  }, fixtureText);
  await page.waitForTimeout(2500);
}

test.describe("fixtures_core.md render", () => {
  test("renders diagrams and math", async ({ page }) => {
    await loadFixture(page);
    await page.waitForFunction(() => {
      const diagramImgs = document.querySelectorAll("img.diagram-img").length;
      const mermaidImgs = document.querySelectorAll("img.mermaid-img").length;
      const mathImgs = document.querySelectorAll("img.math-img").length;
      return (
        diagramImgs >= 10 &&
        mermaidImgs >= 8 &&
        mathImgs >= 5
      );
    }, null, { timeout: 25000 });

    const counts = await page.evaluate(() => ({
      diagramImgs: document.querySelectorAll("img.diagram-img").length,
      mermaidImgs: document.querySelectorAll("img.mermaid-img").length,
      mathImgs: document.querySelectorAll("img.math-img").length,
    }));

    expect(counts.diagramImgs).toBeGreaterThanOrEqual(10);
    expect(counts.mermaidImgs).toBeGreaterThanOrEqual(8);
    expect(counts.mathImgs).toBeGreaterThanOrEqual(5);
  });
});
