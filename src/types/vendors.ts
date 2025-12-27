export type MermaidInitializeOptions = {
  startOnLoad?: boolean;
  htmlLabels?: boolean;
  markdownAutoWrap?: boolean;
  wrap?: boolean;
  wrapPadding?: number;
  flowchart?: {
    htmlLabels?: boolean;
    useMaxWidth?: boolean;
    wrappingWidth?: number;
  };
  sequence?: { htmlLabels?: boolean };
  gantt?: { htmlLabels?: boolean };
  [key: string]: unknown;
};

export type MermaidRenderResult = {
  svg: string;
};

export type MermaidAPI = {
  initialize: (opts: MermaidInitializeOptions) => void;
  render: (id: string, src: string) => Promise<MermaidRenderResult>;
};

export type MathJaxAPI = {
  tex2svg: (expr: string, opts: { display: boolean }) => Element;
  startup?: { promise?: Promise<unknown> };
};

export type TurndownConstructor = new (opts: {
  headingStyle: string;
  codeBlockStyle: string;
  bulletListMarker: string;
}) => {
  turndown: (html: string) => string;
};

export type VizInstance = {
  renderSVGElement: (src: string, opts?: { engine?: string }) => SVGElement;
};

export type VizGlobal = {
  instance: () => Promise<VizInstance>;
};

export type WaveDromGlobal = {
  ProcessAll: () => void;
};

export type VegaEmbedResult = {
  view: {
    toSVG: () => Promise<string>;
    toImageURL: (type: "png" | "svg", scale?: number) => Promise<string>;
    finalize: () => void;
  };
};

export type VegaEmbedFn = (
  el: HTMLElement,
  spec: unknown,
  opts: Record<string, unknown>
) => Promise<VegaEmbedResult>;

export type JSON5Global = {
  parse: (src: string) => unknown;
};
