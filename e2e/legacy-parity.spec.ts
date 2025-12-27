import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const map1Path = path.join(process.cwd(), "test", "map1.md");
const map1Text = fs.readFileSync(map1Path, "utf8");
const legacyFileUrl = `file://${path.join(process.cwd(), "legacy", "index.html")}`;

async function loadMap1(page, url) {
  const targetUrl = url === "legacy" ? legacyFileUrl : url;
  await page.goto(targetUrl);
  await page.waitForSelector("#paste", { state: "attached" });
  await page.evaluate((text) => {
    const paste = document.querySelector("#paste");
    if (!paste) return;
    paste.value = text;
    paste.dispatchEvent(new Event("input", { bubbles: true }));
  }, map1Text);
  await page.waitForTimeout(2500);
}

async function getCounts(page) {
  return await page.evaluate(() => ({
    totalImgs: document.querySelectorAll("img").length,
    diagramImgs: document.querySelectorAll("img.diagram-img").length,
    mermaidImgs: document.querySelectorAll("img.mermaid-img").length,
    mathImgs: document.querySelectorAll("img.math-img").length,
    mathLineImgs: document.querySelectorAll("img.math-line-img").length,
  }));
}

test.describe("legacy parity (transitional)", () => {
  test("matches or exceeds legacy render counts", async ({ page, context }) => {
    // Transitional parity test: remove once refactor is fully trusted.
    const legacyPage = await context.newPage();

    await loadMap1(legacyPage, "legacy");
    await loadMap1(page, "/");

    const legacyCounts = await getCounts(legacyPage);
    const currentCounts = await getCounts(page);

    expect(legacyCounts.totalImgs).toBeGreaterThan(0);
    expect(currentCounts.totalImgs).toBeGreaterThanOrEqual(legacyCounts.totalImgs);
    expect(currentCounts.diagramImgs).toBeGreaterThanOrEqual(legacyCounts.diagramImgs);
    expect(currentCounts.mermaidImgs).toBeGreaterThanOrEqual(legacyCounts.mermaidImgs);
    expect(currentCounts.mathImgs).toBeGreaterThanOrEqual(legacyCounts.mathImgs);
    expect(currentCounts.mathLineImgs).toBeGreaterThanOrEqual(legacyCounts.mathLineImgs);

    await legacyPage.close();
  });
});
