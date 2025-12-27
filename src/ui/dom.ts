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
  };
}
