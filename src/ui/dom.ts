export type DomRefs = {
  svgEl: SVGSVGElement;
  overlayEl: HTMLElement;
  pasteEl: HTMLTextAreaElement;
  copyPromptBtn: HTMLButtonElement;
  exampleBtn: HTMLButtonElement;
  toggleEditorBtn: HTMLButtonElement;
  editorPanel: HTMLElement;
  closeEditorBtn: HTMLButtonElement;
  editorTextarea: HTMLTextAreaElement;
  resizeHandle: HTMLElement;
  charCount: HTMLElement;
  autofixBtn: HTMLButtonElement;
  pasteClipboardBtn: HTMLButtonElement;
  resetSessionBtn: HTMLButtonElement;
  // Save modal
  saveModal: HTMLElement;
  saveTitle: HTMLInputElement;
  saveCancelBtn: HTMLButtonElement;
  saveConfirmBtn: HTMLButtonElement;
  // History feature
  saveSnapshotBtn: HTMLButtonElement;
  openHistoryBtn: HTMLButtonElement;
  openHistoryOverlayBtn: HTMLButtonElement;
  historyModal: HTMLElement;
  closeHistoryBtn: HTMLButtonElement;
  historyList: HTMLElement;
  historyEmpty: HTMLElement;
  historySearch: HTMLInputElement;
};

export function getDomRefs(): DomRefs {
  const get = <T extends Element>(selector: string) => {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Missing element: ${selector}`);
    return el as T;
  };

  return {
    svgEl: get<SVGSVGElement>("#mindmap"),
    overlayEl: get<HTMLElement>("#overlay"),
    pasteEl: get<HTMLTextAreaElement>("#paste"),
    copyPromptBtn: get<HTMLButtonElement>("#copyPrompt"),
    exampleBtn: get<HTMLButtonElement>("#example"),
    toggleEditorBtn: get<HTMLButtonElement>("#toggleEditor"),
    editorPanel: get<HTMLElement>("#editorPanel"),
    closeEditorBtn: get<HTMLButtonElement>("#closeEditor"),
    editorTextarea: get<HTMLTextAreaElement>("#editorTextarea"),
    resizeHandle: get<HTMLElement>("#resizeHandle"),
    charCount: get<HTMLElement>("#charCount"),
    autofixBtn: get<HTMLButtonElement>("#autofix"),
    pasteClipboardBtn: get<HTMLButtonElement>("#pasteClipboard"),
    resetSessionBtn: get<HTMLButtonElement>("#resetSession"),
    // Save modal
    saveModal: get<HTMLElement>("#saveModal"),
    saveTitle: get<HTMLInputElement>("#saveTitle"),
    saveCancelBtn: get<HTMLButtonElement>("#saveCancelBtn"),
    saveConfirmBtn: get<HTMLButtonElement>("#saveConfirmBtn"),
    // History feature
    saveSnapshotBtn: get<HTMLButtonElement>("#saveSnapshot"),
    openHistoryBtn: get<HTMLButtonElement>("#openHistory"),
    openHistoryOverlayBtn: get<HTMLButtonElement>("#openHistoryOverlay"),
    historyModal: get<HTMLElement>("#historyModal"),
    closeHistoryBtn: get<HTMLButtonElement>("#closeHistory"),
    historyList: get<HTMLElement>("#historyList"),
    historyEmpty: get<HTMLElement>("#historyEmpty"),
    historySearch: get<HTMLInputElement>("#historySearch"),
  };
}
