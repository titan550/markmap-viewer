export type MarkmapTransformer = {
  transform: (md: string) => { root: unknown };
  md?: {
    renderInline?: (text: string) => string;
  };
};

export type MarkmapInstance = {
  setData: (root: unknown) => void | Promise<void>;
  fit: () => void;
};

export type MarkmapToolbar = {
  attach: (mm: MarkmapInstance) => void;
  render: () => HTMLElement;
};

export type MarkmapOptions = {
  maxWidth?: number; // Max width of node content in pixels; 0 = no limit
};

export type MarkmapAPI = {
  Transformer: new () => MarkmapTransformer;
  Markmap: {
    create: (svg: SVGSVGElement, options?: MarkmapOptions) => MarkmapInstance;
  };
  Toolbar: new () => MarkmapToolbar;
};
