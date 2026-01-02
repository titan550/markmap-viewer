import { test, expect } from "@playwright/test";

async function loadMarkdown(page, markdown: string) {
  await page.goto("/");
  await page.waitForSelector("#paste", { state: "attached" });
  await page.evaluate((md) => {
    const paste = document.querySelector("#paste") as HTMLTextAreaElement;
    if (!paste) return;
    paste.value = md;
    paste.dispatchEvent(new Event("input", { bubbles: true }));
  }, markdown);
  await page.waitForTimeout(1500);
}

test.describe("Prism syntax highlighting", () => {
  test("highlights Python code with Prism tokens", async ({ page }) => {
    const markdown = `# Test
## Python
\`\`\`python
def hello(name):
    return f"Hello, {name}!"
\`\`\``;

    await loadMarkdown(page, markdown);

    const hasTokens = await page.evaluate(() => {
      const codeBlock = document.querySelector('code[class*="language-python"]');
      if (!codeBlock) return false;
      const tokens = codeBlock.querySelectorAll(".token");
      return tokens.length > 0;
    });

    expect(hasTokens).toBe(true);
  });

  test("highlights TypeScript code with Prism tokens", async ({ page }) => {
    const markdown = `# Test
## TypeScript
\`\`\`typescript
type User = { name: string; age: number };
const user: User = { name: "Alice", age: 30 };
\`\`\``;

    await loadMarkdown(page, markdown);

    const hasTokens = await page.evaluate(() => {
      const codeBlock = document.querySelector('code[class*="language-typescript"]');
      if (!codeBlock) return false;
      const tokens = codeBlock.querySelectorAll(".token");
      return tokens.length > 0;
    });

    expect(hasTokens).toBe(true);
  });

  test("highlights SQL code with Prism tokens", async ({ page }) => {
    const markdown = `# Test
## SQL
\`\`\`sql
SELECT * FROM users WHERE status = 'active';
\`\`\``;

    await loadMarkdown(page, markdown);

    const hasTokens = await page.evaluate(() => {
      const codeBlock = document.querySelector('code[class*="language-sql"]');
      if (!codeBlock) return false;
      const tokens = codeBlock.querySelectorAll(".token");
      return tokens.length > 0;
    });

    expect(hasTokens).toBe(true);
  });

  test("normalizes js alias to javascript and highlights", async ({ page }) => {
    const markdown = `# Test
## JavaScript
\`\`\`js
console.log('Hello');
\`\`\``;

    await loadMarkdown(page, markdown);

    const result = await page.evaluate(() => {
      const codeBlock = document.querySelector('code[class*="language-"]');
      if (!codeBlock) return { hasClass: false, hasTokens: false };
      const hasClass = codeBlock.className.includes("language-javascript");
      const tokens = codeBlock.querySelectorAll(".token");
      return { hasClass, hasTokens: tokens.length > 0 };
    });

    expect(result.hasClass).toBe(true);
    expect(result.hasTokens).toBe(true);
  });

  test("normalizes ts alias to typescript and highlights", async ({ page }) => {
    const markdown = `# Test
## TypeScript
\`\`\`ts
const x: number = 42;
\`\`\``;

    await loadMarkdown(page, markdown);

    const result = await page.evaluate(() => {
      const codeBlock = document.querySelector('code[class*="language-"]');
      if (!codeBlock) return { hasClass: false, hasTokens: false };
      const hasClass = codeBlock.className.includes("language-typescript");
      const tokens = codeBlock.querySelectorAll(".token");
      return { hasClass, hasTokens: tokens.length > 0 };
    });

    expect(result.hasClass).toBe(true);
    expect(result.hasTokens).toBe(true);
  });

  test("handles multiple code blocks of different languages", async ({ page }) => {
    const markdown = `# Test
## Python
\`\`\`python
x = 1
\`\`\`

## JavaScript
\`\`\`javascript
const y = 2;
\`\`\`

## SQL
\`\`\`sql
SELECT * FROM table;
\`\`\``;

    await loadMarkdown(page, markdown);

    const counts = await page.evaluate(() => {
      const pythonBlocks = document.querySelectorAll('code[class*="language-python"]');
      const jsBlocks = document.querySelectorAll('code[class*="language-javascript"]');
      const sqlBlocks = document.querySelectorAll('code[class*="language-sql"]');

      let totalTokens = 0;
      document.querySelectorAll('code[class*="language-"]').forEach((block) => {
        totalTokens += block.querySelectorAll(".token").length;
      });

      return {
        python: pythonBlocks.length,
        javascript: jsBlocks.length,
        sql: sqlBlocks.length,
        totalTokens,
      };
    });

    expect(counts.python).toBe(1);
    expect(counts.javascript).toBe(1);
    expect(counts.sql).toBe(1);
    expect(counts.totalTokens).toBeGreaterThan(0);
  });

  test("mixed content: code + mermaid diagram + math", async ({ page }) => {
    const markdown = `# Mixed Content Test
## Mermaid Diagram
\`\`\`mermaid
flowchart LR
  A --> B
\`\`\`

## Python Code
\`\`\`python
def f(x):
    return x + 1
\`\`\`

## Math
$E = mc^2$`;

    await loadMarkdown(page, markdown);

    const counts = await page.evaluate(() => {
      const diagramImgs = document.querySelectorAll("img.diagram-img, img.mermaid-img");
      const mathImgs = document.querySelectorAll("img.math-img");
      const codeBlocks = document.querySelectorAll('code[class*="language-python"]');
      const codeTokens = codeBlocks[0]?.querySelectorAll(".token");

      return {
        diagrams: diagramImgs.length,
        math: mathImgs.length,
        codeBlocks: codeBlocks.length,
        codeTokens: codeTokens?.length || 0,
      };
    });

    expect(counts.diagrams).toBeGreaterThanOrEqual(1);
    expect(counts.math).toBeGreaterThanOrEqual(1);
    expect(counts.codeBlocks).toBe(1);
    expect(counts.codeTokens).toBeGreaterThan(0);
  });

  test("handles unknown language gracefully", async ({ page }) => {
    const markdown = `# Test
## Unknown Language
\`\`\`unknownlang
some code here
\`\`\``;

    await loadMarkdown(page, markdown);

    const mindmapExists = await page.evaluate(() => {
      const svg = document.querySelector("#mindmap");
      return svg !== null;
    });

    expect(mindmapExists).toBe(true);

    const codeBlockExists = await page.evaluate(() => {
      const codeBlock = document.querySelector('code[class*="language-"]');
      return codeBlock !== null;
    });

    expect(codeBlockExists).toBe(true);
  });
});
