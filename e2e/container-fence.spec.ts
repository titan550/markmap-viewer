import { test, expect } from "@playwright/test";

async function loadMarkdown(page, text: string) {
  await page.goto("/");
  await page.waitForSelector("#paste", { state: "attached" });
  await page.evaluate((md) => {
    const paste = document.querySelector("#paste") as HTMLTextAreaElement | null;
    if (!paste) return;
    paste.value = md;
    paste.dispatchEvent(new Event("input", { bubbles: true }));
  }, text);
  await page.waitForTimeout(2500);
}

test.describe("container fence unwrap", () => {
  test.setTimeout(60000);

  test("unwraps markdown container and renders diagrams", async ({ page }) => {
    const markdown =
      "````markdown\n# Title\n\n- Item\n\n```mermaid\nflowchart LR\nA-->B\n```\n````";
    await loadMarkdown(page, markdown);

    await page.waitForFunction(
      () => document.querySelectorAll("foreignObject img.diagram-img").length >= 1,
      { timeout: 30000 }
    );

    const counts = await page.evaluate(() => ({
      nodes: document.querySelectorAll("svg g.markmap-node").length,
      diagrams: document.querySelectorAll("foreignObject img.diagram-img").length,
    }));

    expect(counts.nodes).toBeGreaterThan(1);
    expect(counts.diagrams).toBeGreaterThanOrEqual(1);
  });
});
