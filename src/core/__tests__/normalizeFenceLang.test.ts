import { describe, expect, it } from "vitest";
import { normalizeFenceLang } from "../normalizeFenceLang";

describe("normalizeFenceLang", () => {
  describe("language alias normalization", () => {
    it("normalizes js to javascript", () => {
      const input = "```js\ncode\n```";
      const output = normalizeFenceLang(input);
      expect(output).toBe("```javascript\ncode\n```");
    });

    it("normalizes ts to typescript", () => {
      const input = "```ts\ncode\n```";
      const output = normalizeFenceLang(input);
      expect(output).toBe("```typescript\ncode\n```");
    });

    it("normalizes py to python", () => {
      const input = "```py\ncode\n```";
      const output = normalizeFenceLang(input);
      expect(output).toBe("```python\ncode\n```");
    });

    it("normalizes sh to bash", () => {
      const input = "```sh\ncode\n```";
      const output = normalizeFenceLang(input);
      expect(output).toBe("```bash\ncode\n```");
    });

    it("normalizes shell to bash", () => {
      const input = "```shell\ncode\n```";
      const output = normalizeFenceLang(input);
      expect(output).toBe("```bash\ncode\n```");
    });

    it("normalizes yml to yaml", () => {
      const input = "```yml\ncode\n```";
      const output = normalizeFenceLang(input);
      expect(output).toBe("```yaml\ncode\n```");
    });
  });

  describe("case insensitivity", () => {
    it("normalizes JS (uppercase) to javascript", () => {
      const input = "```JS\ncode\n```";
      const output = normalizeFenceLang(input);
      expect(output).toBe("```javascript\ncode\n```");
    });

    it("normalizes Js (mixed case) to javascript", () => {
      const input = "```Js\ncode\n```";
      const output = normalizeFenceLang(input);
      expect(output).toBe("```javascript\ncode\n```");
    });

    it("normalizes TS (uppercase) to typescript", () => {
      const input = "```TS\ncode\n```";
      const output = normalizeFenceLang(input);
      expect(output).toBe("```typescript\ncode\n```");
    });

    it("normalizes PY (uppercase) to python", () => {
      const input = "```PY\ncode\n```";
      const output = normalizeFenceLang(input);
      expect(output).toBe("```python\ncode\n```");
    });
  });

  describe("preserves non-aliased languages", () => {
    it("preserves python (already normalized)", () => {
      const input = "```python\ncode\n```";
      const output = normalizeFenceLang(input);
      expect(output).toBe("```python\ncode\n```");
    });

    it("preserves javascript (already normalized)", () => {
      const input = "```javascript\ncode\n```";
      const output = normalizeFenceLang(input);
      expect(output).toBe("```javascript\ncode\n```");
    });

    it("preserves rust (not in alias map)", () => {
      const input = "```rust\ncode\n```";
      const output = normalizeFenceLang(input);
      expect(output).toBe("```rust\ncode\n```");
    });

    it("preserves sql (not in alias map)", () => {
      const input = "```sql\ncode\n```";
      const output = normalizeFenceLang(input);
      expect(output).toBe("```sql\ncode\n```");
    });

    it("preserves unknownlang", () => {
      const input = "```unknownlang\ncode\n```";
      const output = normalizeFenceLang(input);
      expect(output).toBe("```unknownlang\ncode\n```");
    });

    it("preserves language with hyphens (vega-lite)", () => {
      const input = "```vega-lite\ncode\n```";
      const output = normalizeFenceLang(input);
      expect(output).toBe("```vega-lite\ncode\n```");
    });
  });

  describe("multiple code blocks", () => {
    it("handles multiple blocks with different languages", () => {
      const input = `# Test
\`\`\`js
const a = 1;
\`\`\`
\`\`\`py
x = 2
\`\`\`
\`\`\`ts
const b: number = 3;
\`\`\``;

      const output = normalizeFenceLang(input);
      expect(output).toContain("```javascript");
      expect(output).toContain("```python");
      expect(output).toContain("```typescript");
      expect(output).not.toContain("```js\n");
      expect(output).not.toContain("```py\n");
      expect(output).not.toContain("```ts\n");
    });

    it("handles multiple blocks with same language", () => {
      const input = `\`\`\`js
code1
\`\`\`

\`\`\`js
code2
\`\`\``;

      const output = normalizeFenceLang(input);
      const matches = output.match(/```javascript/g);
      expect(matches).toHaveLength(2);
    });

    it("handles mixed aliases and full names", () => {
      const input = `\`\`\`js
code1
\`\`\`

\`\`\`javascript
code2
\`\`\``;

      const output = normalizeFenceLang(input);
      expect(output).toContain("```javascript\ncode1");
      expect(output).toContain("```javascript\ncode2");
    });
  });

  describe("edge cases", () => {
    it("normalizes indented code blocks", () => {
      const input = `- Item
  \`\`\`js
  code
  \`\`\``;

      const output = normalizeFenceLang(input);
      expect(output).toBe(`- Item
  \`\`\`javascript
  code
  \`\`\``);
    });

    it("normalizes tilde fences", () => {
      const input = "~~~js\ncode\n~~~";
      const output = normalizeFenceLang(input);
      expect(output).toBe("~~~javascript\ncode\n~~~");
    });

    it("preserves extra tokens after language", () => {
      const input = "```js title=demo\ncode\n```";
      const output = normalizeFenceLang(input);
      expect(output).toBe("```javascript title=demo\ncode\n```");
    });

    it("doesn't modify code content inside fences", () => {
      const input = `\`\`\`js
const js = "js variable";
const ts = "ts variable";
\`\`\``;

      const output = normalizeFenceLang(input);
      expect(output).toContain('const js = "js variable"');
      expect(output).toContain('const ts = "ts variable"');
      expect(output).toContain("```javascript");
    });

    it("doesn't modify inline code", () => {
      const input = "Use `js` or `ts` for code";
      const output = normalizeFenceLang(input);
      expect(output).toBe("Use `js` or `ts` for code");
    });

    it("handles fence with trailing spaces", () => {
      const input = "```js  \ncode\n```";
      const output = normalizeFenceLang(input);
      expect(output).toBe("```javascript\ncode\n```");
    });

    it("preserves empty code blocks", () => {
      const input = "```js\n```";
      const output = normalizeFenceLang(input);
      expect(output).toBe("```javascript\n```");
    });
  });

  describe("doesn't match malformed fences", () => {
    it("normalizes fences with extra tokens on the opening line", () => {
      const input = "```js code on same line";
      const output = normalizeFenceLang(input);
      expect(output).toBe("```javascript code on same line");
    });

    it("normalizes opening fence even without closing (regex matches line-by-line)", () => {
      const input = "```js\ncode";
      const output = normalizeFenceLang(input);
      expect(output).toBe("```javascript\ncode");
    });
  });
});
