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

test.describe("nested lists + code", () => {
  test("renders list text from fixtures_core.md", async ({ page }) => {
    await loadFixture(page);
    await page.waitForFunction(() => {
      const nodes = Array.from(document.querySelectorAll("foreignObject"));
      return nodes.some((node) => (node.textContent || "").includes("Level 1"));
    }, null, { timeout: 25000 });

    const hasLevel1 = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll("foreignObject"));
      return nodes.some((node) => (node.textContent || "").includes("Level 1"));
    });
    expect(hasLevel1).toBe(true);
  });
});
