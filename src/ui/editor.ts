import type { CodeMirrorEditor } from "../types/codemirror";

export type EditorDeps = {
  svgEl: SVGSVGElement;
  toggleEditorBtn: HTMLButtonElement;
  editorPanel: HTMLElement;
  closeEditorBtn: HTMLButtonElement;
  editorTextarea: HTMLTextAreaElement;
  resizeHandle: HTMLElement;
  charCount: HTMLElement;
  pasteEl: HTMLTextAreaElement;
  onRender: (value: string) => void;
  onFit: () => void;
  getPasteMarkdown: (dataTransfer: DataTransfer | null, fallbackOnly?: boolean) => Promise<string>;
  onContentChange?: () => void;
};

export type EditorApi = {
  getValue: () => string;
  setValue: (value: string) => void;
  toggleEditor: (show?: boolean) => void;
  updateCharCount: () => void;
};

export function setupEditor(deps: EditorDeps): EditorApi {
  const {
    svgEl,
    toggleEditorBtn,
    editorPanel,
    closeEditorBtn,
    editorTextarea,
    resizeHandle,
    charCount,
    pasteEl,
    onRender,
    onFit,
    getPasteMarkdown,
    onContentChange,
  } = deps;

  let editorVisible = localStorage.getItem("editorVisible") === "true" || false;
  let editorWidth = parseInt(localStorage.getItem("editorWidth") || "400", 10);
  let isResizing = false;
  let codeMirror: CodeMirrorEditor | null = null;
  let codeMirrorInitialized = false;
  let pendingEditorFocus = false;

  function setEditorWidth(width: number) {
    const minWidth = 250;
    const maxWidth = window.innerWidth - 200;
    editorWidth = Math.max(minWidth, Math.min(maxWidth, width));

    editorPanel.style.width = editorWidth + "px";
    resizeHandle.style.left = editorWidth + "px";

    if (editorVisible) {
      svgEl.style.width = `calc(100vw - ${editorWidth}px)`;
      svgEl.style.marginLeft = editorWidth + "px";
    }

    localStorage.setItem("editorWidth", String(editorWidth));
  }

  function focusEditor() {
    if (codeMirror) {
      codeMirror.refresh();
      codeMirror.focus();
    } else {
      editorTextarea.focus();
    }
  }

  function scheduleEditorFocus() {
    if (!editorVisible) return;
    setTimeout(() => focusEditor(), 360);
  }

  function toggleEditor(show?: boolean) {
    editorVisible = show !== undefined ? show : !editorVisible;

    if (editorVisible) {
      editorPanel.classList.add("visible");
      resizeHandle.classList.add("visible");
      document.body.classList.add("editor-open");
      setEditorWidth(editorWidth);
      pendingEditorFocus = true;

      toggleEditorBtn.style.left = `${editorWidth + 16}px`;

      if (!codeMirrorInitialized) {
        initCodeMirror();
        if (pasteEl.value) {
          setEditorValue(pasteEl.value);
        }
      } else {
        if (pasteEl.value && !getEditorValue()) {
          setEditorValue(pasteEl.value);
        }
      }

      if (codeMirrorInitialized) {
        pendingEditorFocus = false;
        scheduleEditorFocus();
      }
    } else {
      editorPanel.classList.remove("visible");
      resizeHandle.classList.remove("visible");
      document.body.classList.remove("editor-open");
      svgEl.style.width = "100vw";
      svgEl.style.marginLeft = "0";

      toggleEditorBtn.style.left = "16px";
    }

    localStorage.setItem("editorVisible", String(editorVisible));

    setTimeout(() => onFit(), 320);
  }

  function updateCharCount() {
    const count = codeMirror ? codeMirror.getValue().length : editorTextarea.value.length;
    charCount.textContent = `${count} character${count !== 1 ? "s" : ""}`;
  }

  function getEditorValue() {
    return codeMirror ? codeMirror.getValue() : editorTextarea.value;
  }

  function setEditorValue(value: string) {
    if (codeMirror) {
      codeMirror.setValue(value || "");
    } else {
      editorTextarea.value = value || "";
    }
    updateCharCount();
  }

  let editorTimeout: number | null = null;
  const handleEditorInput = () => {
    updateCharCount();
    if (editorTimeout) window.clearTimeout(editorTimeout);
    editorTimeout = window.setTimeout(() => {
      const value = getEditorValue();
      onRender(value);
      pasteEl.value = value;
      onContentChange?.();
    }, 50);
  };

  function initCodeMirror() {
    if (codeMirrorInitialized || !window.CodeMirror) return;

    try {
      codeMirror = window.CodeMirror.fromTextArea(editorTextarea, {
        mode: "gfm",
        lineNumbers: true,
        lineWrapping: true,
        theme: "default",
        placeholder: editorTextarea.placeholder,
        autofocus: false,
        tabSize: 2,
        indentUnit: 2,
        extraKeys: {
          "Ctrl-E": () => toggleEditor(),
          "Cmd-E": () => toggleEditor(),
          "Ctrl-F": "find",
          "Cmd-F": "find",
          "Ctrl-G": "findNext",
          "Cmd-G": "findNext",
          "Shift-Ctrl-G": "findPrev",
          "Shift-Cmd-G": "findPrev",
          "Esc": () => { if (editorVisible) toggleEditor(false); },
        },
      });

      if (codeMirror) {
        codeMirror.on("change", handleEditorInput);

        codeMirror.on("paste", async (...args: unknown[]) => {
          const instance = args[0] as CodeMirrorEditor | undefined;
          const event = args[1] as ClipboardEvent | undefined;
          if (!instance || !event) return;
          event.preventDefault();
          const mdText = await getPasteMarkdown(event.clipboardData);
          if (mdText) instance.replaceSelection(mdText, "around");
        });

        codeMirrorInitialized = true;
        if (editorVisible && pendingEditorFocus) {
          pendingEditorFocus = false;
          scheduleEditorFocus();
        }
      }
    } catch (e) {
      console.warn("CodeMirror initialization failed, using plain textarea:", e);
      codeMirror = null;
      codeMirrorInitialized = false;
      if (editorVisible && pendingEditorFocus) {
        pendingEditorFocus = false;
        setTimeout(() => editorTextarea.focus(), 0);
      }
    }
  }

  toggleEditorBtn.addEventListener("click", () => toggleEditor());
  closeEditorBtn.addEventListener("click", () => toggleEditor(false));

  resizeHandle.addEventListener("mousedown", (e) => {
    isResizing = true;
    resizeHandle.classList.add("dragging");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;
    setEditorWidth(e.clientX);
    onFit();
  });

  document.addEventListener("mouseup", () => {
    if (isResizing) {
      isResizing = false;
      resizeHandle.classList.remove("dragging");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  });

  editorTextarea.addEventListener("input", () => {
    if (!codeMirrorInitialized) {
      handleEditorInput();
    }
  });

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      if (editorVisible && codeMirrorInitialized && codeMirror) {
        e.preventDefault();
        codeMirror.focus();
        codeMirror.execCommand("find");
        return;
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "e") {
      e.preventDefault();
      toggleEditor();
    }
    if (e.key === "Escape" && editorVisible) {
      toggleEditor(false);
    }
  });

  setEditorWidth(editorWidth);

  return {
    getValue: getEditorValue,
    setValue: setEditorValue,
    toggleEditor,
    updateCharCount,
  };
}
