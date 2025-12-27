import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const map1Path = path.join(process.cwd(), "test", "map1.md");
const map1Text = fs.readFileSync(map1Path, "utf8");

async function loadMap1(page) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "# Title ## Node with Mermaid" }).fill(map1Text);
  await page.evaluate(() => {
    const paste = document.querySelector("#paste");
    paste.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForTimeout(2500);
}

test.describe("map1.md render", () => {
  test("renders diagrams and math", async ({ page }) => {
    await loadMap1(page);
    const counts = await page.evaluate(() => ({
      diagramImgs: document.querySelectorAll("img.diagram-img").length,
      mermaidImgs: document.querySelectorAll("img.mermaid-img").length,
      mathImgs: document.querySelectorAll("img.math-img").length,
      mathLineImgs: document.querySelectorAll("img.math-line-img").length,
    }));

    expect(counts.diagramImgs).toBeGreaterThanOrEqual(10);
    expect(counts.mermaidImgs).toBeGreaterThanOrEqual(8);
    expect(counts.mathImgs).toBeGreaterThanOrEqual(2);
    expect(counts.mathLineImgs).toBeGreaterThanOrEqual(3);
  });
});
