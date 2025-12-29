import { getDomRefs } from "./ui/dom";
import { setupEditor } from "./ui/editor";
import { setupExampleButton } from "./ui/example";
import { setupPrompt } from "./ui/prompt";
import { applyPasteText, getPasteMarkdown } from "./ui/paste";
import { setupToolbar } from "./ui/toolbar";
import { createRenderPipeline } from "./render/pipeline";
import { autofixMarkdown } from "./core/autofix";
import type { MarkmapAPI } from "./types/markmap";

const refs = getDomRefs();
const {
  svgEl,
  overlayEl,
  pasteEl,
  copyPromptBtn,
  exampleBtn,
  toggleEditorBtn,
  editorPanel,
  closeEditorBtn,
  editorTextarea,
  resizeHandle,
  charCount,
  autofixBtn,
} = refs;

const mmapi = window.markmap as MarkmapAPI | undefined;
if (!mmapi?.Transformer || !mmapi?.Markmap) {
  alert("Markmap failed to load.");
  throw new Error("Markmap failed to load");
}
const TurndownService = window.TurndownService;
if (!TurndownService) {
  alert("Turndown failed to load.");
  throw new Error("Turndown failed to load");
}
if (!window.mermaid?.render) {
  alert("Mermaid failed to load.");
  throw new Error("Mermaid failed to load");
}

const { Transformer, Markmap, Toolbar } = mmapi;
const transformer = new Transformer();
const mm = Markmap.create(svgEl);

setupToolbar(mm, Toolbar, svgEl, overlayEl, editorPanel);

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

let render: (mdText: string) => Promise<void> = async () => {};

const editorApi = setupEditor({
  svgEl,
  toggleEditorBtn,
  editorPanel,
  closeEditorBtn,
  editorTextarea,
  resizeHandle,
  charCount,
  pasteEl,
  onRender: (value) => render(value),
  onFit: () => mm.fit(),
  getPasteMarkdown: (dt, fallbackOnly) => getPasteMarkdown(dt, turndownService, fallbackOnly),
});

render = createRenderPipeline({
  transformer,
  mm,
  overlayEl,
  pasteEl,
  setEditorValue: (value) => editorApi.setValue(value),
  toggleEditorBtn,
}).render;

setupPrompt(copyPromptBtn);
setupExampleButton(exampleBtn, pasteEl, render);

autofixBtn.addEventListener("click", () => {
  const current = editorApi.getValue();
  if (current) {
    const fixed = autofixMarkdown(current);
    editorApi.setValue(fixed);
    render(fixed);
  }
});

pasteEl.addEventListener("paste", async (ev) => {
  ev.preventDefault();
  const mdText = await getPasteMarkdown(ev.clipboardData, turndownService);
  applyPasteText(mdText, pasteEl, render, true);
  pasteEl.focus();
});

pasteEl.addEventListener("beforeinput", async (ev) => {
  if (ev.inputType !== "insertFromPaste") return;
  ev.preventDefault();
  const mdText = await getPasteMarkdown(null, turndownService, true);
  applyPasteText(mdText, pasteEl, render, true);
  pasteEl.focus();
});

document.addEventListener(
  "paste",
  async (ev) => {
    if (ev.target === pasteEl) return;
    if (editorPanel.contains(ev.target as Node)) return;
    ev.preventDefault();
    const mdText = await getPasteMarkdown(ev.clipboardData, turndownService);
    applyPasteText(mdText, pasteEl, render, true);
    pasteEl.focus();
  },
  true
);

let t: number | null = null;
pasteEl.addEventListener("input", () => {
  if (t) window.clearTimeout(t);
  t = window.setTimeout(() => render(pasteEl.value), 50);
});

window.addEventListener("resize", () => mm.fit());
window.addEventListener("load", () => pasteEl.focus());
