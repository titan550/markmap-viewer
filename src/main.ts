import { getDomRefs } from "./ui/dom";
import { setupEditor } from "./ui/editor";
import { setupExampleButton } from "./ui/example";
import { setupPrompt } from "./ui/prompt";
import { applyPasteText, getPasteMarkdown } from "./ui/paste";
import { setupToolbar } from "./ui/toolbar";
import { createRenderPipeline } from "./render/pipeline";
import { autofixMarkdown } from "./core/autofix";
import {
  createSessionStore,
  createDebouncedSave,
  restoreSessionIfNeeded,
} from "./storage/sessionStore";
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
  pasteClipboardBtn,
  resetSessionBtn,
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

if (window.Prism?.plugins?.autoloader) {
  window.Prism.plugins.autoloader.languages_path =
    "https://cdn.jsdelivr.net/npm/prismjs@1.30.0/components/";
} else {
  console.warn("Prism autoloader not loaded");
}

const { Transformer, Markmap, Toolbar } = mmapi;
const transformer = new Transformer();
const mm = Markmap.create(svgEl, { maxWidth: 300 });

setupToolbar(mm, Toolbar, svgEl, overlayEl, editorPanel);

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

let render: (mdText: string) => Promise<void> = async () => {};

// Session persistence
const sessionStore = createSessionStore();
const debouncedSessionSave = createDebouncedSave(
  sessionStore,
  () => editorApi.getValue() || pasteEl.value,
  1000
);

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
  onContentChange: () => debouncedSessionSave.save(),
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

pasteClipboardBtn.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      applyPasteText(text, pasteEl, render, true);
    }
  } catch {
    pasteEl.focus();
    pasteEl.select();
  }
});

autofixBtn.addEventListener("click", () => {
  const current = editorApi.getValue();
  if (current) {
    const fixed = autofixMarkdown(current);
    editorApi.setValue(fixed);
    render(fixed);
  }
});

resetSessionBtn.addEventListener("click", async () => {
  await sessionStore.clear();
  editorApi.setValue("");
  pasteEl.value = "";
  overlayEl.classList.remove("hidden");
  pasteEl.focus();
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

// Session persistence: lifecycle event handlers
const saveSession = () => {
  debouncedSessionSave.flush();
};

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    saveSession();
  }
});
window.addEventListener("pagehide", saveSession);
window.addEventListener("freeze", saveSession);
window.addEventListener("blur", saveSession);

// Session restoration on pageshow (bfcache)
window.addEventListener("pageshow", async (e) => {
  // @ts-expect-error wasDiscarded is not in TS lib
  if (e.persisted || document.wasDiscarded) {
    await restoreSessionIfNeeded(
      sessionStore,
      () => editorApi.getValue() || pasteEl.value,
      (value) => {
        editorApi.setValue(value);
        pasteEl.value = value;
      },
      render,
      { force: true }
    );
  }
});

// Initial session restore on load
window.addEventListener("load", async () => {
  pasteEl.focus();

  // Restore session if editor is empty
  try {
    const restored = await restoreSessionIfNeeded(
      sessionStore,
      () => editorApi.getValue() || pasteEl.value,
      (value) => {
        editorApi.setValue(value);
        pasteEl.value = value;
      },
      render
    );
    if (restored) {
      // Hide overlay if content was restored
      overlayEl.classList.add("hidden");
    }
  } catch (error) {
    console.warn("Session restore failed:", error);
    // Show overlay on failure - user can start fresh
  }
});
