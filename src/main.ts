import { autofixMarkdown } from "./core/autofix";
import { markmapNormalize } from "./core/markmapNormalize";
import { createRenderPipeline } from "./render/pipeline";
import { expireOldSnapshots } from "./storage/db";
import {
  createSessionStore,
  createDebouncedSave,
  restoreSessionIfNeeded,
} from "./storage/sessionStore";
import { getDomRefs } from "./ui/dom";
import { setupEditor } from "./ui/editor";
import { setupExampleButton } from "./ui/example";
import { initHistoryModal } from "./ui/historyModal";
import { applyPasteText, getPasteMarkdown } from "./ui/paste";
import { setupPrompt } from "./ui/prompt";
import { setupToolbar } from "./ui/toolbar";
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
  saveModal,
  saveTitle,
  saveCancelBtn,
  saveConfirmBtn,
  saveSnapshotBtn,
  openHistoryBtn,
  openHistoryOverlayBtn,
  historyModal,
  closeHistoryBtn,
  historyList,
  historyEmpty,
  historySearch,
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

async function noopRender(_mdText: string): Promise<void> {}

let render: (mdText: string) => Promise<void> = noopRender;

// Session persistence
const sessionStore = createSessionStore();
const debouncedSessionSave = createDebouncedSave(sessionStore, getCurrentMarkdown, 1000);

function handleEditorRender(value: string): void {
  void render(value);
}

function handleFit(): void {
  mm.fit();
}

function handleContentChange(): void {
  debouncedSessionSave.save();
}

function getPasteMarkdownFromEditor(
  dataTransfer: DataTransfer | null,
  fallbackOnly?: boolean
): Promise<string> {
  return getPasteMarkdown(dataTransfer, turndownService, fallbackOnly);
}

const editorApi = setupEditor({
  svgEl,
  toggleEditorBtn,
  editorPanel,
  closeEditorBtn,
  editorTextarea,
  resizeHandle,
  charCount,
  pasteEl,
  onRender: handleEditorRender,
  onFit: handleFit,
  getPasteMarkdown: getPasteMarkdownFromEditor,
  onContentChange: handleContentChange,
});

function getCurrentMarkdown(): string {
  return editorApi.getValue() || pasteEl.value;
}

function setCurrentMarkdown(markdown: string): void {
  editorApi.setValue(markdown);
  pasteEl.value = markdown;
}

function handleFirstRender(): void {
  // Hide overlay and show toggle button when user first renders content
  overlayEl.classList.add("hidden");
  toggleEditorBtn.style.display = "block";
}

function setEditorValue(value: string): void {
  editorApi.setValue(value);
}

const rawRender = createRenderPipeline({
  transformer,
  mm,
  overlayEl,
  pasteEl,
  setEditorValue,
  toggleEditorBtn,
  onFirstRender: handleFirstRender,
}).render;

// Wrap render with normalization to sync editor/pasteEl with normalized content
async function renderNormalized(mdText: string): Promise<void> {
  const trimmed = mdText.trim();
  const hasContent = trimmed.length > 0;
  const normalized = hasContent ? markmapNormalize(mdText) : mdText;

  // Sync sources if normalization changed content
  if (hasContent && normalized !== mdText) {
    pasteEl.value = normalized;
    const editorContent = editorApi.getValue();
    if (editorContent && editorContent !== normalized) {
      editorApi.setValue(normalized);
    }
  }

  await rawRender(normalized);
}

render = renderNormalized;

// History modal state
let lastManualDigest: string | undefined;

// historyApi exposes open/close/save for keyboard shortcuts
function loadHistoryContent(markdown: string): void {
  setCurrentMarkdown(markdown);
  render(markdown);
  overlayEl.classList.add("hidden");
}

function getLastManualDigest(): string | undefined {
  return lastManualDigest;
}

function setLastManualDigest(digest: string): void {
  lastManualDigest = digest;
}

const historyApi = initHistoryModal({
  historyModal,
  closeHistoryBtn,
  historyList,
  historyEmpty,
  historySearch,
  saveSnapshotBtn,
  openHistoryBtn,
  openHistoryOverlayBtn,
  saveModal,
  saveTitle,
  saveCancelBtn,
  saveConfirmBtn,
  getContent: getCurrentMarkdown,
  loadContent: loadHistoryContent,
  getLastManualDigest,
  setLastManualDigest,
});

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

function setAutofixFeedback(label: string): void {
  autofixBtn.textContent = label;
  autofixBtn.disabled = true;
  window.setTimeout(() => {
    autofixBtn.textContent = "Autofix";
    autofixBtn.disabled = false;
  }, 1500);
}

autofixBtn.addEventListener("click", () => {
  const current = editorApi.getValue();
  if (!current) return;

  const fixed = autofixMarkdown(current);
  if (fixed === current) {
    // No changes - brief visual feedback only
    setAutofixFeedback("No changes");
    return;
  }

  // Actually changed
  editorApi.setValue(fixed);
  render(fixed);
  setAutofixFeedback("Fixed!");
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
function saveSession(): void {
  debouncedSessionSave.flush();
}

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
      getCurrentMarkdown,
      setCurrentMarkdown,
      render,
      { force: true }
    );
  }
});

// Initial load - always show landing page, user can load from history
async function handleWindowLoad(): Promise<void> {
  pasteEl.focus();

  // Auto-expire old unpinned snapshots (30 days)
  expireOldSnapshots(30).catch(() => {
    // Ignore expiry errors - best effort
  });
}

window.addEventListener("load", handleWindowLoad);

// Keyboard shortcuts
function handleGlobalKeydown(e: KeyboardEvent): void {
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

  // Ctrl/Cmd+S: Save snapshot
  if (ctrlOrCmd && e.key === "s") {
    e.preventDefault();
    historyApi.save();
  }

  // Ctrl/Cmd+Shift+O: Open history
  if (ctrlOrCmd && e.shiftKey && e.key.toLowerCase() === "o") {
    e.preventDefault();
    historyApi.open();
  }
}

document.addEventListener("keydown", handleGlobalKeydown);
