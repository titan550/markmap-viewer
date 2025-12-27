import type { MarkmapInstance, MarkmapToolbar } from "../types/markmap";

type ToolbarCtor = new () => MarkmapToolbar;

export function setupToolbar(
  mm: MarkmapInstance,
  toolbarCtor: ToolbarCtor,
  svgEl: SVGSVGElement,
  overlayEl: HTMLElement,
  editorPanel: HTMLElement
) {
  const toolbar = new toolbarCtor();
  toolbar.attach(mm);

  const shouldBlockWheel = (target: EventTarget | null) =>
    (target === svgEl || svgEl.contains(target as Node)) &&
    !editorPanel.contains(target as Node) &&
    !overlayEl.contains(target as Node);

  svgEl.addEventListener(
    "wheel",
    (e) => {
      if (shouldBlockWheel(e.target)) e.preventDefault();
    },
    { passive: false }
  );

  const toolbarEl = toolbar.render();
  toolbarEl.style.position = "absolute";
  toolbarEl.style.right = "16px";
  toolbarEl.style.bottom = "16px";
  document.body.appendChild(toolbarEl);
}
