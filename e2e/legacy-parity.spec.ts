import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const fixturePath = path.join(process.cwd(), "test", "fixtures_core.md");
const fixtureText = fs.readFileSync(fixturePath, "utf8");
const legacyFileUrl = `file://${path.join(process.cwd(), "legacy", "index.html")}`;

async function loadFixture(page, url) {
  const targetUrl = url === "legacy" ? legacyFileUrl : url;
  await page.goto(targetUrl);
  await page.waitForSelector("#paste", { state: "attached" });
  await page.evaluate((text) => {
    const paste = document.querySelector("#paste");
    if (!paste) return;
    paste.value = text;
    paste.dispatchEvent(new Event("input", { bubbles: true }));
  }, fixtureText);
  await page.waitForTimeout(2500);
}

async function getCounts(page) {
  return await page.evaluate(() => ({
    totalImgs: document.querySelectorAll("#mindmap img").length,
    diagramImgs: document.querySelectorAll("img.diagram-img").length,
    mermaidImgs: document.querySelectorAll("img.mermaid-img").length,
    mathImgs: document.querySelectorAll("img.math-img").length,
  }));
}

test.describe("legacy parity (transitional)", () => {
  test("matches or exceeds legacy render counts", async ({ page, context }) => {
    const legacyPage = await context.newPage();

    await loadFixture(legacyPage, "legacy");
    await loadFixture(page, "/");

    const legacyCounts = await getCounts(legacyPage);
    const currentCounts = await getCounts(page);

    expect(legacyCounts.totalImgs).toBeGreaterThan(0);
    expect(currentCounts.totalImgs).toBeGreaterThanOrEqual(legacyCounts.totalImgs);
    expect(currentCounts.diagramImgs).toBeGreaterThanOrEqual(legacyCounts.diagramImgs);
    expect(currentCounts.mermaidImgs).toBeGreaterThanOrEqual(legacyCounts.mermaidImgs);
    expect(currentCounts.mathImgs).toBeGreaterThanOrEqual(
      legacyCounts.mathImgs + await legacyPage.evaluate(() =>
        document.querySelectorAll("img.math-line-img").length
      )
    );

    await legacyPage.close();
  });
});
