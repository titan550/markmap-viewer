import type { MarkmapInstance, MarkmapToolbar } from "../types/markmap";

type ToolbarCtor = new () => MarkmapToolbar;

export function setupToolbar(
  mm: MarkmapInstance,
  toolbarCtor: ToolbarCtor,
  svgEl: SVGSVGElement,
  overlayEl: HTMLElement,
  editorPanel: HTMLElement
): void {
  const toolbar = new toolbarCtor();
  toolbar.attach(mm);

  function shouldBlockWheel(target: EventTarget | null): boolean {
    return (
      (target === svgEl || svgEl.contains(target as Node)) &&
      !editorPanel.contains(target as Node) &&
      !overlayEl.contains(target as Node)
    );
  }

  svgEl.addEventListener(
    "wheel",
    (e) => {
      if (shouldBlockWheel(e.target)) e.preventDefault();
    },
    { passive: false }
  );
}
