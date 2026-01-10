import { describe, expect, it } from "vitest";
import {
  applyPasteText,
  clipboardToMarkmapMdFromDataTransfer,
  getPasteMarkdown,
  looksLikeMarkdown,
} from "../paste";

const makeDt = (plain: string, html = "") => ({
  getData: (type: string) => (type === "text/plain" ? plain : html),
});

const turndownService = {
  turndown: (html: string) => html.replace(/<[^>]+>/g, ""),
};

describe("looksLikeMarkdown", () => {
  it("detects headings and lists", () => {
    expect(looksLikeMarkdown("# Title")).toBe(true);
    expect(looksLikeMarkdown("- Item")).toBe(true);
    expect(looksLikeMarkdown("Plain text")).toBe(false);
  });
});

describe("clipboardToMarkmapMdFromDataTransfer", () => {
  it("prefers markdown plain text", () => {
    const dt = makeDt("# Title");
    const out = clipboardToMarkmapMdFromDataTransfer(dt as DataTransfer, turndownService);
    expect(out).toContain("# Title");
  });

  it("falls back to html conversion", () => {
    const dt = makeDt("", "<h1>Title</h1>");
    const out = clipboardToMarkmapMdFromDataTransfer(dt as DataTransfer, turndownService);
    expect(out).toContain("# Title");
  });

  it("falls back to plain text when turndown fails", () => {
    const dt = makeDt("Plain text", "<div>Ignored</div>");
    const brokenTurndown = {
      turndown: () => {
        throw new Error("fail");
      },
    };
    const out = clipboardToMarkmapMdFromDataTransfer(dt as DataTransfer, brokenTurndown);
    expect(out).toContain("Plain text");
  });
});

describe("applyPasteText", () => {
  it("replaces paste text", () => {
    const textarea = document.createElement("textarea");
    const render = (val: string) => {
      textarea.dataset.rendered = val;
    };
    applyPasteText("# Title", textarea, render, true);
    expect(textarea.value).toBe("# Title");
  });

  it("appends paste text when replaceAll is false", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "Start ";
    applyPasteText("More", textarea, () => {}, false);
    expect(textarea.value).toContain("More");
  });
});

describe("getPasteMarkdown", () => {
  it("uses data transfer when available", async () => {
    const dt = makeDt("# Title");
    const out = await getPasteMarkdown(dt as DataTransfer, turndownService, false);
    expect(out).toContain("# Title");
  });

  it("falls back to clipboard readText when requested", async () => {
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      value: { readText: async () => "# Title" },
      configurable: true,
    });
    const out = await getPasteMarkdown(null, turndownService, true);
    expect(out).toContain("# Title");
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      configurable: true,
    });
  });
});
